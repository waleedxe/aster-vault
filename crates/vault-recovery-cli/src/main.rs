//! Aster Vault recovery command-line tool.
//!
//! Purpose: a broken desktop UI must never strand backups. This binary depends
//! only on `vault-core` and can inspect/restore an encrypted container on a clean
//! machine using the master password or the recovery key.
//!
//! Full restore implementation lands in Phase 3. For now it exposes the vault
//! core version so the toolchain is wired end to end.

use vault_core::FORMAT_VERSION;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("version") | Some("--version") | Some("-V") => {
            println!("aster-vault-recovery (container format v{FORMAT_VERSION})");
        }
        _ => {
            eprintln!("Aster Vault recovery tool");
            eprintln!();
            eprintln!("Usage:");
            eprintln!("  aster-vault-recovery version    Print tool and format version");
            eprintln!();
            eprintln!("Restore commands are implemented in Phase 3 (see docs/specs/05).");
        }
    }
}
