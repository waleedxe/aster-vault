//! Local password strength and reuse analysis.
//!
//! Computed entirely on the device; never transmitted. This is a heuristic, not
//! a guarantee — it must be presented as factual and short, and never signalled
//! by colour alone.

use std::collections::HashMap;

/// Small list of very common passwords used only to flag obviously weak ones.
const COMMON: &[&str] = &[
    "password", "123456", "12345678", "qwerty", "111111", "abc123", "letmein", "welcome", "monkey",
    "dragon", "master", "admin", "login", "princess", "football", "iloveyou", "sunshine",
    "trustno1", "passw0rd", "hello", "freedom", "whatever", "qazwsx", "shadow", "superman",
    "batman",
];

/// A strength estimate for one password.
#[derive(Debug, Clone, PartialEq)]
pub struct Strength {
    /// Bucketed score 0 (very weak) to 4 (very strong).
    pub score: u8,
    /// Estimated entropy in bits.
    pub entropy_bits: f64,
    /// Whether the password appears in the small common-password list.
    pub is_common: bool,
}

impl Strength {
    /// A short, factual English label. The UI translates by score.
    pub fn label(&self) -> &'static str {
        match self.score {
            0 => "Very weak",
            1 => "Weak",
            2 => "Fair",
            3 => "Strong",
            _ => "Very strong",
        }
    }
}

fn pool_size(password: &str) -> u32 {
    let mut pool = 0;
    if password.chars().any(|c| c.is_ascii_lowercase()) {
        pool += 26;
    }
    if password.chars().any(|c| c.is_ascii_uppercase()) {
        pool += 26;
    }
    if password.chars().any(|c| c.is_ascii_digit()) {
        pool += 10;
    }
    if password.chars().any(|c| !c.is_ascii_alphanumeric()) {
        pool += 32;
    }
    pool.max(1)
}

/// Estimate the strength of a password.
pub fn estimate(password: &str) -> Strength {
    let length = password.chars().count();
    let pool = pool_size(password);
    let mut entropy = length as f64 * (pool as f64).log2();

    let lower = password.to_lowercase();
    let is_common = COMMON.contains(&lower.as_str());
    if is_common {
        entropy = entropy.min(10.0);
    }
    // Penalise obvious sequential or repeated runs.
    if password.chars().count() >= 3 {
        let chars: Vec<char> = password.chars().collect();
        let all_same = chars.iter().all(|c| *c == chars[0]);
        if all_same {
            entropy = entropy.min(12.0);
        }
    }

    let score = if is_common || entropy < 28.0 {
        0
    } else if entropy < 40.0 {
        1
    } else if entropy < 60.0 {
        2
    } else if entropy < 80.0 {
        3
    } else {
        4
    };

    Strength {
        score,
        entropy_bits: entropy,
        is_common,
    }
}

/// Count how many non-empty passwords are used by more than one item.
pub fn reused_count(passwords: &[String]) -> usize {
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for password in passwords {
        if password.is_empty() {
            continue;
        }
        *counts.entry(password.as_str()).or_insert(0) += 1;
    }
    counts.values().filter(|count| **count > 1).count()
}
