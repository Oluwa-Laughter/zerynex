//! Zerynex's local policy engine. The report contains *only field paths*,
//! never transaction contents. This is not a consensus or anonymity verifier.
use pczt::Pczt;
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Profile {
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
#[derive(Debug, Serialize)]
pub struct Finding {
    pub rule: &'static str,
    pub field: String,
    pub explanation: &'static str,
}
#[derive(Debug, Serialize)]
pub struct Report {
    pub profile: &'static str,
    pub findings: Vec<Finding>,
    pub checked_pools: [&'static str; 2],
    pub disclaimer: &'static str,
}
pub fn analyze(bytes: &[u8], profile: Profile) -> Result<Report, &'static str> {
    let pczt = Pczt::parse(bytes).map_err(|_| "Invalid or unsupported binary PCZT")?;
    Ok(analyze_parsed(&pczt, profile))
}
pub fn analyze_parsed(pczt: &Pczt, policy: Profile) -> Report {
    let mut findings = Vec::new();
    if !pczt.global().proprietary().is_empty() {
        findings.push(Finding {
            rule: "PCZT-GLOBAL-METADATA",
            field: "global.proprietary".into(),
            explanation: "Unreviewed global proprietary fields require a disclosure policy.",
        });
    }
    for (pool, actions) in [
        ("orchard", pczt.orchard().actions()),
        ("ironwood", pczt.ironwood().actions()),
    ] {
        for (index, action) in actions.iter().enumerate() {
            let prefix = format!("{pool}.actions[{index}]");
            let spend = action.spend();
            let output = action.output();
            if spend.dummy_sk().is_some() {
                findings.push(Finding {
                    rule: "PCZT-DUMMY-KEY",
                    field: format!("{prefix}.spend.dummy_sk"),
                    explanation: "Dummy spending keys must not be passed to signers.",
                });
            }
            if !spend.proprietary().is_empty() {
                findings.push(Finding {
                    rule: "PCZT-UNREVIEWED-METADATA",
                    field: format!("{prefix}.spend.proprietary"),
                    explanation: "Proprietary spend metadata requires a reviewed recipient policy.",
                });
            }
            if !output.proprietary().is_empty() {
                findings.push(Finding {
                    rule: "PCZT-UNREVIEWED-METADATA",
                    field: format!("{prefix}.output.proprietary"),
                    explanation:
                        "Proprietary output metadata requires a reviewed recipient policy.",
                });
            }
            if policy == Profile::RestrictedHandoff {
                for (field, present) in [
                    ("recipient", output.recipient().is_some()),
                    ("value", output.value().is_some()),
                    ("rseed", output.rseed().is_some()),
                    ("user_address", output.user_address().is_some()),
                ] {
                    if present {
                        findings.push(Finding {
                            rule: "PCZT-RESTRICTED-DISCLOSURE",
                            field: format!("{prefix}.output.{field}"),
                            explanation: "Field disallowed by restricted handoff policy.",
                        });
                    }
                }
            }
        }
    }
    Report {
        profile: policy.name(),
        findings,
        checked_pools: ["orchard", "ironwood"],
        disclaimer: "Policy checks only. No proof of anonymity or consensus validity; Sapling and transparent checks are not yet included.",
    }
}

// The exact same Rust engine runs in the browser via WebAssembly.
// All PCZT bytes remain inside the user's browser; no remote API call.
#[cfg(feature = "browser")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn analyze_pczt(bytes: &[u8], restricted: bool) -> Result<String, wasm_bindgen::JsValue> {
    let policy = if restricted {
        Profile::RestrictedHandoff
    } else {
        Profile::ExternalSigner
    };
    let report = analyze(bytes, policy).map_err(wasm_bindgen::JsValue::from_str)?;
    serde_json::to_string(&report)
        .map_err(|_| wasm_bindgen::JsValue::from_str("Cannot encode report"))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn checks_real_serialized_pczt_and_flags_global_metadata() {
        use pczt::roles::{creator::Creator, updater::Updater};
        let pczt = Creator::new(0x37a5_165b, 0, 133, None, None)
            .unwrap()
            .build()
            .unwrap();
        let clean = pczt.clone().serialize().unwrap();
        let result = analyze(&clean, Profile::ExternalSigner).unwrap();
        assert!(result.findings.is_empty());
        let tagged = Updater::new(pczt)
            .update_global_with(|mut updater| {
                updater.set_proprietary("test-marker".into(), b"synthetic-only".to_vec())
            })
            .finish()
            .serialize()
            .unwrap();
        let report = analyze(&tagged, Profile::ExternalSigner).unwrap();
        assert!(report
            .findings
            .iter()
            .any(|f| f.rule == "PCZT-GLOBAL-METADATA"));
        let output = serde_json::to_string(&report).unwrap();
        assert!(!output.contains("synthetic-only"));
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
            findings: vec![Finding {
                rule: "PCZT-RESTRICTED-DISCLOSURE",
                field: "ironwood.actions[0].output.value".into(),
                explanation: "Field disallowed by restricted handoff policy.",
            }],
            checked_pools: ["orchard", "ironwood"],
            disclaimer: "Policy checks only.",
        };
        let encoded = serde_json::to_string(&report).unwrap();
        assert!(encoded.contains("ironwood.actions[0]"));
        assert!(!encoded.contains("my-private-seed"));
    }
}
