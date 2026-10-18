//! Stable, reviewed metadata for implemented structural PCZT findings.
//!
//! The versioned JSON is compiled into Rust and synchronized verbatim to
//! SDK snapshots. This catalog describes observations, not a wallet audit.
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RuleDefinition {
    pub id: String,
    pub title: String,
    pub severity: String,
    pub category: String,
    pub applies_to: Vec<String>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RuleCatalog {
    pub schema_version: u32,
    pub tool: String,
    pub rule_set_version: String,
    pub scope: String,
    pub rules: Vec<RuleDefinition>,
}

const EMBEDDED: &str = include_str!("../rules/catalog.json");
static REGISTRY: OnceLock<RuleCatalog> = OnceLock::new();

/// Versioned metadata (no network, PCZT bytes or filesystem reads).
pub fn rule_catalog() -> &'static RuleCatalog {
    REGISTRY.get_or_init(|| {
        let parsed: RuleCatalog = serde_json::from_str(EMBEDDED)
            .expect("bundled, reviewed rule registry must be valid JSON");
        assert_eq!(parsed.schema_version, 1);
        assert_eq!(parsed.tool, "zerynex");
        assert_eq!(parsed.rule_set_version, "1.0.0");
        assert_eq!(parsed.rules.len(), 8);
        let mut previous = "";
        for item in &parsed.rules {
            assert!(item.id.starts_with("PCZT-"));
            assert!(
                item.id.as_str() > previous,
                "rule IDs must be unique and sorted"
            );
            assert!(matches!(item.severity.as_str(), "warning" | "error"));
            assert!(!item.applies_to.is_empty());
            previous = &item.id;
        }
        parsed
    })
}

pub fn find_rule(id: &str) -> Option<&'static RuleDefinition> {
    rule_catalog().rules.iter().find(|item| item.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn versioned_registry_is_unique_and_scope_is_explicit() {
        let catalog = rule_catalog();
        assert_eq!(catalog.rules.len(), 8);
        assert!(catalog.scope.contains("No cryptographic proof"));
        for rule in &catalog.rules {
            assert_eq!(
                find_rule(&rule.id).map(|found| &found.title),
                Some(&rule.title)
            );
            assert!(rule.applies_to.contains(&"stage_comparison".to_string()));
        }
        assert!(find_rule("arbitrary request").is_none());
    }
}
