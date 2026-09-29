//! Password and passphrase generation.
//!
//! All randomness comes from the OS CSPRNG. Generation is local and never logs
//! or transmits the result.

use rand::rngs::OsRng;
use rand::seq::SliceRandom;
use rand::Rng;

use crate::crypto::rng::fill;

/// Options for password generation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PasswordOptions {
    /// Desired length.
    pub length: usize,
    /// Include lowercase letters.
    pub lowercase: bool,
    /// Include uppercase letters.
    pub uppercase: bool,
    /// Include digits.
    pub digits: bool,
    /// Include symbols.
    pub symbols: bool,
    /// Exclude visually ambiguous characters (0/O, 1/l/I).
    pub exclude_ambiguous: bool,
}

impl Default for PasswordOptions {
    fn default() -> Self {
        Self {
            length: 20,
            lowercase: true,
            uppercase: true,
            digits: true,
            symbols: true,
            exclude_ambiguous: true,
        }
    }
}

const LOWERCASE: &str = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS: &str = "0123456789";
const SYMBOLS: &str = "!@#$%^&*()-_=+[]{};:,.?/";
const AMBIGUOUS: &[char] = &['0', 'O', 'o', '1', 'l', 'I'];

fn classes(options: &PasswordOptions) -> Vec<String> {
    let mut out = Vec::new();
    if options.lowercase {
        out.push(LOWERCASE.to_string());
    }
    if options.uppercase {
        out.push(UPPERCASE.to_string());
    }
    if options.digits {
        out.push(DIGITS.to_string());
    }
    if options.symbols {
        out.push(SYMBOLS.to_string());
    }
    out
}

/// Generate a random password honouring `options`.
///
/// Guarantees at least one character from each selected class when the length
/// allows. Falls back to lowercase if no class is selected.
pub fn generate_password(options: &PasswordOptions) -> String {
    let mut pools = classes(options);
    if pools.is_empty() {
        pools.push(LOWERCASE.to_string());
    }

    let mut all: Vec<char> = Vec::new();
    for pool in &pools {
        for ch in pool.chars() {
            if options.exclude_ambiguous && AMBIGUOUS.contains(&ch) {
                continue;
            }
            all.push(ch);
        }
    }
    if all.is_empty() {
        all.push('a');
    }

    let length = options.length.max(1);
    let mut rng = OsRng;
    let mut out: Vec<char> = Vec::with_capacity(length);

    // One from each class first (when there is room), then fill randomly.
    let mut filtered_pools: Vec<Vec<char>> = pools
        .iter()
        .map(|pool| {
            pool.chars()
                .filter(|ch| !(options.exclude_ambiguous && AMBIGUOUS.contains(ch)))
                .collect::<Vec<char>>()
        })
        .filter(|pool| !pool.is_empty())
        .collect();

    for pool in &mut filtered_pools {
        if out.len() < length {
            out.push(pool[rng.gen_range(0..pool.len())]);
        }
    }
    while out.len() < length {
        out.push(all[rng.gen_range(0..all.len())]);
    }

    // Shuffle so class characters are not in a predictable position.
    out.shuffle(&mut rng);
    out.into_iter().collect()
}

/// Options for passphrase generation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PassphraseOptions {
    /// Number of words.
    pub words: usize,
    /// Separator between words.
    pub separator: String,
    /// Capitalise each word.
    pub capitalize: bool,
}

impl Default for PassphraseOptions {
    fn default() -> Self {
        Self {
            words: 4,
            separator: "-".to_string(),
            capitalize: true,
        }
    }
}

/// Generate a passphrase from the built-in word list.
pub fn generate_passphrase(options: &PassphraseOptions) -> String {
    let count = options.words.max(1);
    let mut rng = OsRng;
    let mut selected = Vec::with_capacity(count);
    for _ in 0..count {
        let word = WORDLIST[rng.gen_range(0..WORDLIST.len())];
        selected.push(if options.capitalize {
            capitalize_first(word)
        } else {
            word.to_string()
        });
    }
    selected.join(&options.separator)
}

fn capitalize_first(word: &str) -> String {
    let mut chars = word.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

/// Generate a random recovery-style hex string (used for diagnostics only).
pub fn random_hex(bytes: usize) -> String {
    let mut buf = vec![0u8; bytes];
    fill(&mut buf);
    buf.iter().map(|b| format!("{b:02x}")).collect()
}

/// A small, built-in word list for passphrases (~4,000 bits combos at 4 words).
pub const WORDLIST: &[&str] = &[
    "able", "acid", "acorn", "actor", "agent", "alarm", "album", "alert", "alien", "alley",
    "amber", "anchor", "angle", "apple", "apron", "arena", "arrow", "aspen", "atlas", "atom",
    "autumn", "avenue", "bacon", "badge", "baker", "balcony", "bamboo", "banjo", "barn", "basil",
    "beacon", "beetle", "began", "bench", "berry", "birch", "bishop", "bison", "blade", "blast",
    "blaze", "bloom", "blue", "bolt", "bonus", "boulder", "bracket", "brave", "bread", "breeze",
    "brick", "bridge", "bright", "brook", "brush", "bubble", "bucket", "budget", "buffalo", "bugle",
    "bundle", "butter", "cabin", "cactus", "camel", "candle", "canoe", "canyon", "carbon", "cargo",
    "carpet", "castle", "cedar", "cello", "chalk", "charm", "cherry", "chess", "chief", "chime",
    "cider", "cinema", "circle", "citrus", "clever", "cliff", "cloud", "clover", "coast", "cobalt",
    "cocoa", "comet", "compass", "copper", "coral", "cosmic", "cotton", "cougar", "crane", "crater",
    "cricket", "crimson", "crystal", "cypress", "dagger", "daisy", "dance", "dawn", "delta", "denim",
    "desert", "diamond", "diesel", "dinner", "dolphin", "domino", "donut", "dragon", "drizzle", "drum",
    "dune", "eagle", "ember", "emerald", "engine", "escort", "ethical", "fable", "falcon", "fancy",
    "feather", "fennel", "fern", "fiddle", "field", "finch", "flame", "flint", "florist", "forest",
    "fossil", "fountain", "fox", "frog", "frost", "galaxy", "garden", "garlic", "gecko", "ginger",
    "glacier", "globe", "glow", "gold", "gopher", "granite", "grape", "griffin", "grove", "guitar",
    "gulf", "hammer", "hamster", "harbor", "hazel", "helmet", "heron", "hickory", "honey", "hornet",
    "horse", "hotel", "hunter", "igloo", "indigo", "island", "ivory", "jacket", "jaguar", "jasmine",
    "jelly", "jewel", "jungle", "juniper", "kayak", "kettle", "kitten", "koala", "lagoon", "lantern",
    "lark", "laser", "laurel", "lava", "lemon", "leopard", "lever", "lichen", "lilac", "lily",
    "linen", "lion", "lizard", "lobster", "locket", "lotus", "lumber", "lunar", "lynx", "magnet",
    "mango", "maple", "marble", "marigold", "meadow", "melon", "mentor", "meteor", "midnight", "mint",
    "mirror", "misty", "mitten", "monsoon", "moose", "moss", "mountain", "mural", "nectar", "needle",
    "nebula", "nickel", "noble", "nomad", "noodle", "north", "nutmeg", "oasis", "ocean", "olive",
    "onion", "onyx", "opal", "orbit", "orchid", "otter", "owl", "oyster", "paddle", "palace",
    "palm", "panda", "pantry", "papaya", "parrot", "pastel", "pebble", "pelican", "penguin", "pepper",
    "petal", "piano", "pigeon", "pillow", "pilot", "pine", "pistol", "planet", "plum", "pollen",
    "poncho", "poplar", "portal", "potato", "prairie", "prism", "puffin", "pumpkin", "quartz", "quill",
    "quiver", "rabbit", "radar", "radish", "raven", "reef", "ribbon", "river", "robin", "rocket",
    "rodeo", "rope", "rose", "ruby", "rudder", "saddle", "saffron", "sage", "salmon", "sandal",
    "sapphire", "satin", "scale", "scarlet", "scroll", "seal", "sequoia", "shadow", "shark", "shelter",
    "silk", "silver", "siren", "sketch", "sky", "slate", "sleigh", "sloth", "smoky", "snap",
    "solar", "sonnet", "sparrow", "spice", "spider", "spiral", "spruce", "squash", "stable", "star",
    "statue", "steel", "stone", "storm", "sunset", "swan", "sycamore", "table", "talon", "tango",
    "teal", "temple", "thistle", "thunder", "tiger", "timber", "toffee", "topaz", "torch", "toucan",
    "tower", "trail", "trout", "tulip", "tundra", "turtle", "ultra", "unicorn", "valley", "vanilla",
    "velvet", "vendor", "venus", "vessel", "vine", "violet", "viper", "vista", "vulture", "walnut",
    "walrus", "wave", "weasel", "whale", "wheat", "willow", "wind", "winter", "wolf", "wombat",
    "wren", "yarrow", "yonder", "zebra", "zenith", "zephyr", "zigzag", "zinc",
];
