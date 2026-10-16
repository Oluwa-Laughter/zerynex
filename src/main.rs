use clap::{Parser, ValueEnum};
use pczt::Pczt;
use serde::Serialize;
use std::{fs, path::PathBuf, process::ExitCode};

#[derive(Parser)]
#[command(
    name = "zerynex",
    version,
    about = "Local privacy-policy analysis for Zcash PCZT files"
)]
struct Args {
    /// Binary PCZT file: never uploaded or transmitted.
    file: PathBuf,
    #[arg(long, value_enum, default_value_t = Policy::ExternalSigner)]
    profile: Policy,
    #[arg(long)]
    json: bool,
}

#[derive(Clone, Copy, ValueEnum, Debug, PartialEq, Eq)]
enum Policy {
    ExternalSigner,
    RestrictedHandoff,
}

#[derive(Debug, Serialize)]
struct Finding {
    rule: &'static str,
    field: String,
    explanation: &'static str,
}

#[derive(Debug, Serialize)]
struct Report {
    profile: &'static str,
    findings: Vec<Finding>,
}

fn analyze(pczt: &Pczt, policy: Policy) -> Report {
    let mut findings = Vec::new();
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
                    explanation: "Proprietary spend metadata needs an explicit recipient policy.",
                });
            }
            if !output.proprietary().is_empty() {
                findings.push(Finding {
                    rule: "PCZT-UNREVIEWED-METADATA",
                    field: format!("{prefix}.output.proprietary"),
                    explanation: "Proprietary output metadata needs an explicit recipient policy.",
                });
            }
            if policy == Policy::RestrictedHandoff {
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
        profile: match policy {
            Policy::ExternalSigner => "external_signer",
            Policy::RestrictedHandoff => "restricted_handoff",
        },
        findings,
    }
}

fn run() -> Result<ExitCode, &'static str> {
    let args = Args::parse();
    let metadata = fs::metadata(&args.file).map_err(|_| "Cannot read PCZT file")?;
    if !metadata.is_file() || metadata.len() > 8 * 1024 * 1024 {
        return Err("Expected a regular PCZT file no larger than 8 MiB");
    }
    let bytes = fs::read(&args.file).map_err(|_| "Cannot read PCZT file")?;
    // Do not log upstream parsing errors; they may expose transaction data.
    let pczt = Pczt::parse(&bytes).map_err(|_| "Invalid or unsupported binary PCZT")?;
    let report = analyze(&pczt, args.profile);
    if args.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&report).map_err(|_| "Report error")?
        );
    } else {
        println!("Zerynex: {} finding(s)", report.findings.len());
        for f in &report.findings {
            println!("{} at {}: {}", f.rule, f.field, f.explanation);
        }
    }
    Ok(if report.findings.is_empty() {
        ExitCode::SUCCESS
    } else {
        ExitCode::from(2)
    })
}

fn main() -> ExitCode {
    match run() {
        Ok(code) => code,
        Err(message) => {
            eprintln!("Zerynex: {message}");
            ExitCode::from(1)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parser_rejects_invalid_pczt_input() {
        assert!(Pczt::parse(b"synthetic-not-a-pczt").is_err());
    }

    #[test]
    fn report_serialization_avoids_raw_values() {
        let report = Report {
            profile: "restricted_handoff",
            findings: vec![Finding {
                rule: "PCZT-RESTRICTED-DISCLOSURE",
                field: "ironwood.actions[0].output.value".into(),
                explanation: "Field disallowed by restricted handoff policy.",
            }],
        };
        let encoded = serde_json::to_string(&report).unwrap();
        assert!(encoded.contains("ironwood.actions[0]"));
        assert!(!encoded.contains("synthetic private key"));
    }
}
