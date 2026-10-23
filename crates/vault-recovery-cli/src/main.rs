//! Aster Vault recovery command-line tool.
//!
//! Purpose: a broken desktop UI must never strand backups. This binary depends
//! only on `vault-core` and can inspect/restore an encrypted container on a clean
//! machine using the master password or the recovery key.
//!
//! Security rules: secrets are **never** passed as command-line arguments (they
//! would leak into shell history and process listings). Credentials are read from
//! standard input.
//!
//! Usage:
//!   aster-vault-recovery version
//!   aster-vault-recovery verify <file>
//!   aster-vault-recovery inspect <file>                 # password on stdin
//!   aster-vault-recovery restore <file> --out <path>    # password on stdin
//!   aster-vault-recovery restore <file> --out <path> --recovery  # key on stdin

use std::io::{self, Write};
use std::path::PathBuf;
use std::process::ExitCode;

use vault_core::backup;
use vault_core::crypto::keys::RecoveryKey;
use vault_core::FORMAT_VERSION;
use zeroize::Zeroizing;

fn usage() {
    eprintln!("Aster Vault recovery tool (container format v{FORMAT_VERSION})");
    eprintln!();
    eprintln!("Usage:");
    eprintln!("  aster-vault-recovery version");
    eprintln!("  aster-vault-recovery verify  <file>");
    eprintln!("  aster-vault-recovery inspect <file>");
    eprintln!("  aster-vault-recovery restore <file> --out <path> [--recovery]");
    eprintln!();
    eprintln!("Credentials are read from stdin, never from arguments.");
}

/// Read a secret from stdin (one line), with the prompt written to stderr.
///
/// When stdin is an interactive console the terminal echo is switched off while
/// the credential is typed, so it never appears on screen or in scrollback; when
/// stdin is redirected (a pipe or a file) the line is read normally so the tool
/// stays scriptable. The returned buffer is zeroized when it is dropped.
fn read_secret(label: &str) -> io::Result<Zeroizing<String>> {
    eprint!("{label}: ");
    io::stderr().flush()?;

    let mut line = Zeroizing::new(String::new());

    #[cfg(windows)]
    {
        let mut echo = console::EchoGuard::disable();
        io::stdin().read_line(&mut line)?;
        if let Some(guard) = echo.take() {
            drop(guard);
            // Echo was off, so the user's Enter was not displayed.
            eprintln!();
        }
    }
    #[cfg(not(windows))]
    {
        io::stdin().read_line(&mut line)?;
    }

    let trimmed_len = line.trim_end_matches(['\n', '\r']).len();
    line.truncate(trimmed_len);
    Ok(line)
}

/// Minimal Windows console helper: disable echo only when stdin is a console.
#[cfg(windows)]
mod console {
    use std::ffi::c_void;

    const STD_INPUT_HANDLE: u32 = -10i32 as u32;
    const ENABLE_ECHO_INPUT: u32 = 0x0004;

    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn GetStdHandle(n_std_handle: u32) -> *mut c_void;
        fn GetConsoleMode(console_handle: *mut c_void, mode: *mut u32) -> i32;
        fn SetConsoleMode(console_handle: *mut c_void, mode: u32) -> i32;
    }

    /// Restores the console input mode on drop. `None` means stdin is not an
    /// interactive console (echo cannot be disabled) and the caller should read
    /// normally.
    pub struct EchoGuard {
        handle: *mut c_void,
        mode: u32,
    }

    impl EchoGuard {
        /// Disable echo if stdin is a console; returns `None` otherwise.
        pub fn disable() -> Option<Self> {
            unsafe {
                let handle = GetStdHandle(STD_INPUT_HANDLE);
                let mut mode = 0u32;
                if handle.is_null() || GetConsoleMode(handle, &mut mode) == 0 {
                    return None;
                }
                if SetConsoleMode(handle, mode & !ENABLE_ECHO_INPUT) == 0 {
                    return None;
                }
                Some(Self { handle, mode })
            }
        }
    }

    impl Drop for EchoGuard {
        fn drop(&mut self) {
            unsafe {
                SetConsoleMode(self.handle, self.mode);
            }
        }
    }
}

fn read_file(path: &str) -> Result<Vec<u8>, String> {
    std::fs::read(path).map_err(|e| format!("could not read {path}: {e}"))
}

fn cmd_verify(path: &str) -> Result<(), String> {
    let bytes = read_file(path)?;
    let manifest = backup::verify_structure(&bytes).map_err(|e| e.to_string())?;
    println!("Structure: OK");
    println!("Kind: {:?}", manifest.kind);
    println!("Created at: {}", manifest.created_at);
    println!("Authentication: not checked (requires a credential)");
    Ok(())
}

fn cmd_inspect(path: &str) -> Result<(), String> {
    let bytes = read_file(path)?;
    let password = read_secret("Master password").map_err(|e| e.to_string())?;
    let manifest = backup::inspect(&bytes, password.as_str()).map_err(|e| e.to_string())?;
    println!("Authentication: OK");
    println!("Kind: {:?}", manifest.kind);
    println!("Created at: {}", manifest.created_at);
    println!("Items: {}", manifest.item_count.unwrap_or(0));
    Ok(())
}

fn cmd_restore(file: &str, out: &str, use_recovery: bool) -> Result<(), String> {
    let bytes = read_file(file)?;
    let destination = PathBuf::from(out);
    let manifest = if use_recovery {
        let key_str = read_secret("Recovery key").map_err(|e| e.to_string())?;
        let key = RecoveryKey::decode(key_str.as_str()).map_err(|e| e.to_string())?;
        backup::restore_to_path_with_recovery(&bytes, &key, &destination)
    } else {
        let password = read_secret("Master password").map_err(|e| e.to_string())?;
        backup::restore_to_path(&bytes, password.as_str(), &destination)
    }
    .map_err(|e| format!("restore failed: {e}"))?;

    println!(
        "Restored {} items to {}",
        manifest.item_count.unwrap_or(0),
        out
    );
    Ok(())
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("version") | Some("--version") | Some("-V") => {
            println!("aster-vault-recovery (container format v{FORMAT_VERSION})");
            Ok(())
        }
        Some("verify") => match args.get(1) {
            Some(path) => cmd_verify(path),
            None => Err("verify requires a <file>".to_string()),
        },
        Some("inspect") => match args.get(1) {
            Some(path) => cmd_inspect(path),
            None => Err("inspect requires a <file>".to_string()),
        },
        Some("restore") => {
            let file = args.get(1).cloned();
            let out = flag_value(&args, "--out");
            let use_recovery = args.iter().any(|a| a == "--recovery");
            match (file, out) {
                (Some(file), Some(out)) => cmd_restore(&file, &out, use_recovery),
                _ => Err("restore requires <file> and --out <path>".to_string()),
            }
        }
        _ => {
            usage();
            return ExitCode::from(2);
        }
    };

    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("error: {message}");
            ExitCode::FAILURE
        }
    }
}

fn flag_value(args: &[String], flag: &str) -> Option<String> {
    let index = args.iter().position(|a| a == flag)?;
    args.get(index + 1).cloned()
}
