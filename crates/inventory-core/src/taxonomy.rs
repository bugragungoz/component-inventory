//! The fixed English category names and the aliases that fold into them. The frontend has the full
//! taxonomy with subcategories and icons (`src/domain/taxonomy.ts`); this side only needs the names
//! to normalize legacy values during a migration. Keep both lists in step
//! (`tests/taxonomy_parity` reads the TypeScript file).

use crate::model::UNCATEGORIZED;

pub const CANONICAL_CATEGORIES: &[&str] = &[
    "Resistors",
    "Potentiometers",
    "Thermistors",
    "Varistors",
    "Capacitors",
    "Inductors",
    "Transformers",
    "Transistors",
    "Thyristors",
    "Diodes",
    "LEDs",
    "ICs",
    "Microcontrollers",
    "Sensors",
    "Relays",
    "Connectors",
    "Crystals",
    "Switches",
    "Modules",
    "Mechanical",
    "Consumables",
    UNCATEGORIZED,
];

/// Lower-case alias -> canonical name. Includes the duplicates found in the owner's database on
/// 2026-10-03 ("Thyristors & Triacs", "Unclassified", "Consumables & Tools").
const ALIASES: &[(&str, &str)] = &[
    ("thyristors & triacs", "Thyristors"),
    ("thyristor", "Thyristors"),
    ("triac", "Thyristors"),
    ("triacs", "Thyristors"),
    ("scr", "Thyristors"),
    ("unclassified", UNCATEGORIZED),
    ("uncategorised", UNCATEGORIZED),
    ("other", UNCATEGORIZED),
    ("misc", UNCATEGORIZED),
    ("consumables & tools", "Consumables"),
    ("consumable", "Consumables"),
    ("diode", "Diodes"),
    ("ic", "ICs"),
    ("integrated circuit", "ICs"),
    ("integrated circuits", "ICs"),
    ("mosfet", "Transistors"),
    ("mosfets", "Transistors"),
    ("bjt", "Transistors"),
    ("bjts", "Transistors"),
    ("transistor", "Transistors"),
    ("igbt", "Transistors"),
    ("igbts", "Transistors"),
    ("resistor", "Resistors"),
    ("capacitor", "Capacitors"),
    ("cap", "Capacitors"),
    ("inductor", "Inductors"),
    ("transformer", "Transformers"),
    ("connector", "Connectors"),
    ("sensor", "Sensors"),
    ("crystal", "Crystals"),
    ("oscillator", "Crystals"),
    ("relay", "Relays"),
    ("led", "LEDs"),
    ("microcontroller", "Microcontrollers"),
    ("mcu", "Microcontrollers"),
    ("mcus", "Microcontrollers"),
    ("switch", "Switches"),
    ("module", "Modules"),
    ("tool", "Consumables"),
    ("tools", "Consumables"),
    ("diyot", "Diodes"),
    ("diyotlar", "Diodes"),
    ("direnc", "Resistors"),
    ("direnç", "Resistors"),
    ("direncler", "Resistors"),
    ("dirençler", "Resistors"),
    ("kondansator", "Capacitors"),
    ("kondansatör", "Capacitors"),
    ("kondansatorler", "Capacitors"),
    ("kondansatörler", "Capacitors"),
    ("bobin", "Inductors"),
    ("bobinler", "Inductors"),
    ("transistorler", "Transistors"),
    ("transistörler", "Transistors"),
    ("sensorler", "Sensors"),
    ("sensörler", "Sensors"),
    ("roleler", "Relays"),
    ("röleler", "Relays"),
    ("role", "Relays"),
    ("röle", "Relays"),
    ("konektor", "Connectors"),
    ("konnektör", "Connectors"),
    ("konektorler", "Connectors"),
    ("konnektörler", "Connectors"),
    ("mikrodenetleyici", "Microcontrollers"),
    ("mikrodenetleyiciler", "Microcontrollers"),
];

/// Turkish-aware lower case for the few dotted/dotless letters, then ASCII lower case.
fn fold(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'İ' => 'i',
            'I' => 'ı',
            _ => c,
        })
        .flat_map(char::to_lowercase)
        .collect::<String>()
        .replace('ı', "i")
}

/// Returns the canonical name for a stored category, or the trimmed input when it is a category the
/// user made up (those are kept as they are). Empty becomes "Uncategorized".
pub fn normalize_category(input: &str) -> String {
    let raw = input.trim();
    if raw.is_empty() {
        return UNCATEGORIZED.to_string();
    }
    if CANONICAL_CATEGORIES.contains(&raw) {
        return raw.to_string();
    }
    let key = fold(raw);
    let key = key.trim_end_matches(|c: char| c.is_whitespace() || "-_/.".contains(c));
    if let Some(canon) = CANONICAL_CATEGORIES.iter().find(|c| fold(c) == key) {
        return (*canon).to_string();
    }
    if let Some((_, canon)) = ALIASES.iter().find(|(a, _)| fold(a) == key) {
        return (*canon).to_string();
    }
    raw.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folds_the_owners_duplicates() {
        assert_eq!(normalize_category("Thyristors & Triacs"), "Thyristors");
        assert_eq!(normalize_category("Unclassified"), UNCATEGORIZED);
        assert_eq!(normalize_category("Consumables & Tools"), "Consumables");
        assert_eq!(normalize_category(""), UNCATEGORIZED);
        assert_eq!(normalize_category("  "), UNCATEGORIZED);
    }

    #[test]
    fn keeps_canonical_and_user_categories() {
        assert_eq!(normalize_category("Resistors"), "Resistors");
        assert_eq!(normalize_category("resistors"), "Resistors");
        assert_eq!(normalize_category("Legacy Parts (Sony/VCR)"), "Legacy Parts (Sony/VCR)");
    }

    #[test]
    fn folds_aliases_in_both_languages() {
        assert_eq!(normalize_category("MOSFETs"), "Transistors");
        assert_eq!(normalize_category("DİYOT"), "Diodes");
        assert_eq!(normalize_category("Dirençler"), "Resistors");
    }
}
