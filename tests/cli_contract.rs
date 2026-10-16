//! External integration contract: fixture input, exit codes, JSON report shape.
use serde_json::Value;
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
