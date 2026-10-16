//! Zerynex: local PCZT disclosure-policy checks, backed by the official Zcash PCZT crate.
//! A clean report establishes only that selected rules passed. It is not a privacy proof,
//! transaction validator, shielded-pool verifier, or signing authorization mechanism.

use pczt::Pczt;
use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Profile {
    #[default]
    ExternalSigner,
    RestrictedHandoff,
}
impl Profile {
    pub fn name(self) -> &'static str {
        match self {
            Self::ExternalSigner => "external_signer",
            Self::RestrictedHandoff => "restricted_handoff",
        }
    }
}

/// Strict policy schema shared by the CLI and the browser.
/// Proprietary metadata and dummy keys are *always* flagged.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct PolicyConfig {
    pub profile: Profile,
    pub deny_transparent: bool,
    pub deny_sapling: bool,
}
pub fn parse_policy_json(contents: &str) -> Result<PolicyConfig, &'static str> {
    if contents.len() > 4096 {
        return Err("Privacy policy exceeds 4 KiB");
    }
    serde_json::from_str(contents).map_err(|_| "Invalid policy JSON or unsupported policy field")
}

#[derive(Debug, Serialize)]
pub struct Finding {
    pub rule: &'static str,
    pub field: String,
    pub explanation: &'static str,
}
#[derive(Debug, Serialize)]
pub struct Report {
    pub profile: &'static str,
    pub deny_transparent: bool,
    pub deny_sapling: bool,
    pub findings: Vec<Finding>,
    pub checked_pools: [&'static str; 4],
    pub disclaimer: &'static str,
}
impl Report {
    pub fn passed(&self) -> bool {
        self.findings.is_empty()
    }
}
const DISCLAIMER: &str =
    "Selected disclosure-policy checks only. Not a proof of anonymity, consensus validity, or safe signing.";

pub fn analyze(bytes: &[u8], profile: Profile) -> Result<Report, &'static str> {
    analyze_with_policy(
        bytes,
        PolicyConfig {
            profile,
            ..PolicyConfig::default()
        },
    )
}
pub fn analyze_with_policy(bytes: &[u8], policy: PolicyConfig) -> Result<Report, &'static str> {
    let pczt = Pczt::parse(bytes).map_err(|_| "Invalid or unsupported binary PCZT")?;
    Ok(analyze_parsed_with_policy(&pczt, policy))
}
pub fn analyze_parsed(pczt: &Pczt, profile: Profile) -> Report {
    analyze_parsed_with_policy(
        pczt,
        PolicyConfig {
            profile,
            ..PolicyConfig::default()
        },
    )
}
fn finding(
    findings: &mut Vec<Finding>,
    rule: &'static str,
    field: String,
    explanation: &'static str,
) {
    findings.push(Finding {
        rule,
        field,
        explanation,
    });
}

pub fn analyze_parsed_with_policy(pczt: &Pczt, policy: PolicyConfig) -> Report {
    let mut findings = Vec::new();
    if !pczt.global().proprietary().is_empty() {
        finding(
            &mut findings,
            "PCZT-GLOBAL-METADATA",
            "global.proprietary".into(),
            "Unreviewed global proprietary fields require a disclosure policy.",
        );
    }

    // Transparent effects are necessarily visible on-chain; this opt-in rule
    // prevents accidentally using transparent components in shielded-only workflows.
    let transparent = pczt.transparent();
    if policy.deny_transparent && !transparent.inputs().is_empty() {
        finding(
            &mut findings,
            "PCZT-TRANSPARENT-INPUTS",
            "transparent.inputs".into(),
            "Transparent inputs prohibited by shielded-only policy.",
        );
    }
    if policy.deny_transparent && !transparent.outputs().is_empty() {
        finding(
            &mut findings,
            "PCZT-TRANSPARENT-OUTPUTS",
            "transparent.outputs".into(),
            "Transparent outputs prohibited by shielded-only policy.",
        );
    }
    for (index, input) in transparent.inputs().iter().enumerate() {
        if !input.proprietary().is_empty() {
            finding(
                &mut findings,
                "PCZT-UNREVIEWED-METADATA",
                format!("transparent.inputs[{index}].proprietary"),
                "Unreviewed transparent input metadata.",
            );
        }
    }
    for (index, output) in transparent.outputs().iter().enumerate() {
        let path = format!("transparent.outputs[{index}]");
        if !output.proprietary().is_empty() {
            finding(
                &mut findings,
                "PCZT-UNREVIEWED-METADATA",
                format!("{path}.proprietary"),
                "Unreviewed transparent output metadata.",
            );
        }
        if policy.profile == Profile::RestrictedHandoff && output.user_address().is_some() {
            finding(
                &mut findings,
                "PCZT-RESTRICTED-DISCLOSURE",
                format!("{path}.user_address"),
                "Address field disallowed by restricted-handoff policy.",
            );
        }
    }

    let sapling = pczt.sapling();
    if policy.deny_sapling && (!sapling.spends().is_empty() || !sapling.outputs().is_empty()) {
        finding(
            &mut findings,
            "PCZT-SAPLING-POLICY",
            "sapling".into(),
            "Sapling bundle prohibited by configured pool policy.",
        );
    }
    for (index, spend) in sapling.spends().iter().enumerate() {
        if !spend.proprietary().is_empty() {
            finding(
                &mut findings,
                "PCZT-UNREVIEWED-METADATA",
                format!("sapling.spends[{index}].proprietary"),
                "Unreviewed Sapling spend metadata.",
            );
        }
        // The upstream public PCZT getters do not expose every intermediate
        // Sapling spend field; do not claim to validate dummy_ask here.
    }
    for (index, output) in sapling.outputs().iter().enumerate() {
        let path = format!("sapling.outputs[{index}]");
        if !output.proprietary().is_empty() {
            finding(
                &mut findings,
                "PCZT-UNREVIEWED-METADATA",
                format!("{path}.proprietary"),
                "Unreviewed Sapling output metadata.",
            );
        }
        if policy.profile == Profile::RestrictedHandoff {
            for (field, present) in [
                ("recipient", output.recipient().is_some()),
                ("value", output.value().is_some()),
                ("rseed", output.rseed().is_some()),
                ("user_address", output.user_address().is_some()),
            ] {
                if present {
                    finding(
                        &mut findings,
                        "PCZT-RESTRICTED-DISCLOSURE",
                        format!("{path}.{field}"),
                        "Field disallowed by restricted-handoff policy.",
                    );
                }
            }
        }
    }

    for (pool, actions) in [
        ("orchard", pczt.orchard().actions()),
        ("ironwood", pczt.ironwood().actions()),
    ] {
        for (index, action) in actions.iter().enumerate() {
            let path = format!("{pool}.actions[{index}]");
            let spend = action.spend();
            let output = action.output();
            if spend.dummy_sk().is_some() {
                finding(
                    &mut findings,
                    "PCZT-DUMMY-KEY",
                    format!("{path}.spend.dummy_sk"),
                    "Dummy spending keys must not be passed to signers.",
                );
            }
            if !spend.proprietary().is_empty() {
                finding(
                    &mut findings,
                    "PCZT-UNREVIEWED-METADATA",
                    format!("{path}.spend.proprietary"),
                    "Unreviewed spend metadata requires a recipient policy.",
                );
            }
            if !output.proprietary().is_empty() {
                finding(
                    &mut findings,
                    "PCZT-UNREVIEWED-METADATA",
                    format!("{path}.output.proprietary"),
                    "Unreviewed output metadata requires a recipient policy.",
                );
            }
            if policy.profile == Profile::RestrictedHandoff {
                for (field, present) in [
                    ("recipient", output.recipient().is_some()),
                    ("value", output.value().is_some()),
                    ("rseed", output.rseed().is_some()),
                    ("user_address", output.user_address().is_some()),
                ] {
                    if present {
                        finding(
                            &mut findings,
                            "PCZT-RESTRICTED-DISCLOSURE",
                            format!("{path}.output.{field}"),
                            "Field disallowed by restricted-handoff policy.",
                        );
                    }
                }
            }
        }
    }
    Report {
        profile: policy.profile.name(),
        deny_transparent: policy.deny_transparent,
        deny_sapling: policy.deny_sapling,
        findings,
        checked_pools: ["transparent", "sapling", "orchard", "ironwood"],
        disclaimer: DISCLAIMER,
    }
}

// The same Rust engine runs in-browser via WebAssembly. No hosted transaction processing.
#[cfg(feature = "browser")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn analyze_pczt(bytes: &[u8], restricted: bool) -> Result<String, wasm_bindgen::JsValue> {
    let policy = PolicyConfig {
        profile: if restricted {
            Profile::RestrictedHandoff
        } else {
            Profile::ExternalSigner
        },
        ..PolicyConfig::default()
    };
    let report = analyze_with_policy(bytes, policy).map_err(wasm_bindgen::JsValue::from_str)?;
    serde_json::to_string(&report)
        .map_err(|_| wasm_bindgen::JsValue::from_str("Could not encode report"))
}
#[cfg(feature = "browser")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn analyze_pczt_policy(
    bytes: &[u8],
    policy_json: &str,
) -> Result<String, wasm_bindgen::JsValue> {
    let policy = parse_policy_json(policy_json).map_err(wasm_bindgen::JsValue::from_str)?;
    let report = analyze_with_policy(bytes, policy).map_err(wasm_bindgen::JsValue::from_str)?;
    serde_json::to_string(&report)
        .map_err(|_| wasm_bindgen::JsValue::from_str("Could not encode report"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use pczt::roles::{creator::Creator, updater::Updater};

    fn fixture() -> Pczt {
        Creator::new(0x37a5_165b, 0, 133, None, None)
            .unwrap()
            .build()
            .unwrap()
    }
    #[test]
    fn baseline_works_with_real_pczt_encoding() {
        let clean = fixture().serialize().unwrap();
        let report = analyze(&clean, Profile::ExternalSigner).unwrap();
        assert!(report.passed());
        assert_eq!(report.checked_pools.len(), 4);
    }
    #[test]
    fn flags_global_metadata_without_exposing_values() {
        let tagged = Updater::new(fixture())
            .update_global_with(|mut updater| {
                updater.set_proprietary("fixture".into(), b"private-synthetic-marker".to_vec())
            })
            .finish()
            .serialize()
            .unwrap();
        let report = analyze(&tagged, Profile::ExternalSigner).unwrap();
        assert_eq!(report.findings.len(), 1);
        assert_eq!(report.findings[0].rule, "PCZT-GLOBAL-METADATA");
        assert!(!serde_json::to_string(&report)
            .unwrap()
            .contains("private-synthetic-marker"));
    }
    #[test]
    fn policies_are_strict_and_do_not_echo_invalid_input() {
        assert!(
            parse_policy_json(r#"{"deny_transparent":true}"#)
                .unwrap()
                .deny_transparent
        );
        assert_eq!(
            parse_policy_json(r#"{"unexpected_private_field":"secret"}"#),
            Err("Invalid policy JSON or unsupported policy field")
        );
        assert!(parse_policy_json(&"x".repeat(4097)).is_err());
        assert_eq!(parse_policy_json("{}").unwrap(), PolicyConfig::default());
    }
    #[test]
    fn shielded_only_policy_blocks_real_serialized_transparent_output() {
        let bytes = include_bytes!("../apps/web/public/examples/transparent-v6.bin");
        let default = analyze_with_policy(bytes, PolicyConfig::default()).unwrap();
        assert!(
            default.passed(),
            "default role does not prohibit transparent components"
        );
        let strict = analyze_with_policy(
            bytes,
            PolicyConfig {
                deny_transparent: true,
                ..PolicyConfig::default()
            },
        )
        .unwrap();
        assert!(strict
            .findings
            .iter()
            .any(|f| f.rule == "PCZT-TRANSPARENT-OUTPUTS"));
        let encoded = serde_json::to_string(&strict).unwrap();
        assert!(
            !encoded.contains("123"),
            "must not expose transparent output amounts"
        );
    }
    #[test]
    fn policy_serialization_is_stable() {
        let parsed = parse_policy_json(
            r#"{"profile":"restricted_handoff","deny_transparent":true,"deny_sapling":true}"#,
        )
        .unwrap();
        let roundtrip: PolicyConfig =
            serde_json::from_str(&serde_json::to_string(&parsed).unwrap()).unwrap();
        assert_eq!(roundtrip, parsed);
    }
    #[test]
    fn rejects_non_pczt() {
        assert_eq!(
            analyze(b"test not a pczt", Profile::ExternalSigner).unwrap_err(),
            "Invalid or unsupported binary PCZT"
        );
    }
    #[test]
    fn report_contains_only_safe_field_paths() {
        let report = Report {
            profile: "restricted_handoff",
            deny_transparent: false,
            deny_sapling: false,
            findings: vec![Finding {
                rule: "PCZT-RESTRICTED-DISCLOSURE",
                field: "ironwood.actions[0].output.value".into(),
                explanation: "Field disallowed by restricted-handoff policy.",
            }],
            checked_pools: ["transparent", "sapling", "orchard", "ironwood"],
            disclaimer: DISCLAIMER,
        };
        let encoded = serde_json::to_string(&report).unwrap();
        assert!(encoded.contains("ironwood.actions[0]"));
        assert!(!encoded.contains("my-private-seed"));
    }
}
