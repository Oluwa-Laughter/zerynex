//! External integration contract: fixture input, exit codes, JSON report shape.
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::Value;
use std::io::Write;
use std::{
    path::PathBuf,
    process::{Command, Output},
};

fn base() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}
fn execute(arguments: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_zerynex"))
        .current_dir(base())
        .args(arguments)
        .output()
        .expect("execute the compiled Rust Zerynex CLI")
}
fn json(output: &Output) -> Value {
    serde_json::from_slice(&output.stdout).expect("CLI must emit structured JSON")
}

#[test]
fn clean_fixture_preserves_machine_readable_contract() {
    let output = execute(&[
        "apps/web/public/examples/clean-v6.bin",
        "--policy-file",
        "policies/shielded-only.json",
        "--json",
    ]);
    assert_eq!(output.status.code(), Some(0));
    let report = json(&output);
    assert_eq!(report["profile"], "external_signer");
    assert_eq!(report["deny_transparent"], true);
    assert_eq!(report["deny_sapling"], false);
    assert_eq!(report["findings"].as_array().unwrap().len(), 0);
    assert_eq!(report["checked_pools"].as_array().unwrap().len(), 4);
    assert!(report["disclaimer"]
        .as_str()
        .unwrap()
        .contains("Not a proof"));
}

#[test]
fn metadata_violation_uses_exit_two_and_redacts_values() {
    let output = execute(&["apps/web/public/examples/flagged-v6.bin", "--json"]);
    assert_eq!(output.status.code(), Some(2));
    let report = json(&output);
    assert_eq!(report["findings"][0]["rule"], "PCZT-GLOBAL-METADATA");
    assert_eq!(report["findings"][0]["field"], "global.proprietary");
    assert!(!String::from_utf8_lossy(&output.stdout).contains("synthetic-only"));
}

#[test]
fn transparent_output_respects_configured_policy() {
    let restricted = execute(&[
        "apps/web/public/examples/transparent-v6.bin",
        "--deny-transparent",
        "--json",
    ]);
    assert_eq!(restricted.status.code(), Some(2));
    assert_eq!(
        json(&restricted)["findings"][0]["rule"],
        "PCZT-TRANSPARENT-OUTPUTS"
    );
    let baseline = execute(&["apps/web/public/examples/transparent-v6.bin", "--json"]);
    assert_eq!(baseline.status.code(), Some(0));
}

#[test]
fn unreadable_input_uses_distinct_error_code() {
    let output = execute(&["missing.pczt", "--json"]);
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
}

#[test]
fn zallet_style_base64_on_stdin_matches_binary_policy_findings() {
    let input = std::fs::read(base().join("apps/web/public/examples/transparent-v6.bin"))
        .expect("synthetic PCZT fixture exists");
    let base64 = STANDARD.encode(&input);
    let mut child = Command::new(env!("CARGO_BIN_EXE_zerynex"))
        .args([
            "-",
            "--input-format",
            "base64",
            "--deny-transparent",
            "--json",
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .expect("start Rust binary");
    child
        .stdin
        .take()
        .unwrap()
        .write_all(base64.as_bytes())
        .unwrap();
    let result = child.wait_with_output().expect("retrieve report");
    assert_eq!(result.status.code(), Some(2));
    let report = json(&result);
    assert_eq!(report["findings"][0]["rule"], "PCZT-TRANSPARENT-OUTPUTS");
    assert_eq!(report["deny_transparent"], true);
}

#[test]
fn binary_stdin_matches_regular_file() {
    let source = std::fs::read(base().join("apps/web/public/examples/clean-v6.bin")).unwrap();
    let mut child = Command::new(env!("CARGO_BIN_EXE_zerynex"))
        .args(["-", "--json"])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.take().unwrap().write_all(&source).unwrap();
    let report = child.wait_with_output().unwrap();
    assert_eq!(report.status.code(), Some(0));
    assert_eq!(json(&report)["findings"].as_array().unwrap().len(), 0);
}

#[test]
fn malformed_base64_returns_sanitized_exit_one() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_zerynex"))
        .args(["-", "--input-format", "base64", "--json"])
        .stdin(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(b"SYNTHETIC_SENSITIVE_STRING!")
        .unwrap();
    let result = child.wait_with_output().unwrap();
    assert_eq!(result.status.code(), Some(1));
    assert!(result.stdout.is_empty());
    assert!(!String::from_utf8_lossy(&result.stderr).contains("SYNTHETIC_SENSITIVE_STRING!"));
}

#[test]
fn stage_comparison_detects_new_policy_findings_without_raw_values() {
    let output = execute(&[
        "apps/web/public/examples/clean-v6.bin",
        "--compare-with",
        "apps/web/public/examples/flagged-v6.bin",
        "--json",
    ]);
    assert_eq!(output.status.code(), Some(2));
    let report = json(&output);
    assert_eq!(report["added_findings"][0]["rule"], "PCZT-GLOBAL-METADATA");
    assert_eq!(report["added_findings"][0]["field"], "global.proprietary");
    assert_eq!(report["before_findings_count"], 0);
    assert_eq!(report["after_findings_count"], 1);
    assert_eq!(report["passed"], false);
    assert!(!String::from_utf8_lossy(&output.stdout).contains("synthetic-only"));
}

#[test]
fn stage_comparison_flags_component_changes_without_revealing_values() {
    let output = execute(&[
        "apps/web/public/examples/clean-v6.bin",
        "--compare-with",
        "apps/web/public/examples/transparent-v6.bin",
        "--json",
    ]);
    assert_eq!(output.status.code(), Some(2));
    let report = json(&output);
    assert_eq!(report["added_findings"].as_array().unwrap().len(), 0);
    assert_eq!(
        report["component_deltas"][0]["component"],
        "transparent.outputs"
    );
    assert_eq!(report["component_deltas"][0]["before"], 0);
    assert_eq!(report["component_deltas"][0]["after"], 1);
    assert_eq!(report["passed"], false);
    assert!(!String::from_utf8_lossy(&output.stdout).contains("123"));
}

#[test]
fn stage_comparison_passes_when_policy_violation_is_resolved() {
    let output = execute(&[
        "apps/web/public/examples/flagged-v6.bin",
        "--compare-with",
        "apps/web/public/examples/clean-v6.bin",
        "--json",
    ]);
    assert_eq!(output.status.code(), Some(0));
    let report = json(&output);
    assert_eq!(
        report["resolved_findings"][0]["rule"],
        "PCZT-GLOBAL-METADATA"
    );
    assert_eq!(report["passed"], true);
}

#[test]
fn stage_comparison_does_not_mask_existing_violations() {
    let output = execute(&[
        "apps/web/public/examples/flagged-v6.bin",
        "--compare-with",
        "apps/web/public/examples/flagged-v6.bin",
        "--json",
    ]);
    assert_eq!(output.status.code(), Some(2));
    let report = json(&output);
    assert_eq!(report["no_new_findings"], true);
    assert_eq!(report["passed"], false);
}

#[test]
fn oversized_file_is_rejected_without_emitting_input() {
    let location = std::env::temp_dir().join(format!(
        "zerynex-oversize-{}-{}.pczt",
        std::process::id(),
        "contract"
    ));
    let file = std::fs::File::create(&location).unwrap();
    file.set_len(8 * 1024 * 1024 + 1).unwrap();
    let output = execute(&[location.to_str().unwrap(), "--json"]);
    std::fs::remove_file(location).unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    assert!(!String::from_utf8_lossy(&output.stderr).contains("zerynex-oversize-"));
}

#[test]
fn oversized_policy_is_rejected_without_echoing_contents() {
    let location = std::env::temp_dir().join(format!(
        "zerynex-policy-{}-{}.json",
        std::process::id(),
        "contract"
    ));
    std::fs::write(&location, vec![b'X'; 4097]).unwrap();
    let output = execute(&[
        "apps/web/public/examples/clean-v6.bin",
        "--policy-file",
        location.to_str().unwrap(),
        "--json",
    ]);
    std::fs::remove_file(location).unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
}

#[test]
fn capabilities_are_machine_readable_without_pczt_or_network() {
    let output = execute(&["--capabilities"]);
    assert_eq!(output.status.code(), Some(0));
    assert!(output.stderr.is_empty());
    let contract = json(&output);
    assert_eq!(contract["schema_version"], 1);
    assert_eq!(contract["tool"], "zerynex");
    assert_eq!(contract["cli_version"], env!("CARGO_PKG_VERSION"));
    assert_eq!(contract["max_decoded_pczt_bytes"], 8 * 1024 * 1024);
    assert_eq!(contract["max_policy_file_bytes"], 4096);
    assert_eq!(contract["network_access"], false);
    assert_eq!(contract["signing"], false);
    assert!(contract["operations"]
        .as_array()
        .unwrap()
        .contains(&serde_json::json!("compare_pczt_stages")));
    assert_eq!(contract["exit_codes"]["findings_or_regressions"], 2);
}

#[test]
fn capabilities_refuse_conflicting_flags_or_file_inputs() {
    for args in [
        vec!["--capabilities", "--deny-transparent"],
        vec!["--capabilities", "apps/web/public/examples/clean-v6.bin"],
        vec!["--capabilities", "--json"],
    ] {
        let output = execute(&args);
        assert_ne!(output.status.code(), Some(0));
        assert!(output.stdout.is_empty());
    }
    let output = execute(&["--json"]);
    assert_ne!(output.status.code(), Some(0));
    assert!(output.stdout.is_empty());
}
