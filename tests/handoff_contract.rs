//! Consumer-level contract checks: the upstream-role synthetic fixture workflow.
use serde_json::{json, Value};
use std::{
    fs,
    path::PathBuf,
    process::{Command, Output},
    sync::atomic::{AtomicU64, Ordering},
};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn run(manifest: &std::path::Path) -> Output {
    Command::new(env!("CARGO_BIN_EXE_zerynex-handoff"))
        .arg("--manifest")
        .arg(manifest)
        .arg("--json")
        .output()
        .expect("run the synthetic lifecycle harness")
}

fn manifest(value: Value) -> (PathBuf, PathBuf) {
    let dir = std::env::temp_dir().join(format!(
        "zerynex-role-handoff-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed),
    ));
    fs::create_dir(&dir).expect("make isolated test directory");
    fs::write(
        dir.join("00-created.bin"),
        fs::read(root().join("tests/fixtures/role-handoff/00-created.bin"))
            .expect("synthetic fixture"),
    )
    .unwrap();
    fs::write(
        dir.join("01-updated.bin"),
        fs::read(root().join("tests/fixtures/role-handoff/01-updated.bin"))
            .expect("synthetic fixture"),
    )
    .unwrap();
    let path = dir.join("scenario.json");
    fs::write(&path, serde_json::to_vec(&value).unwrap()).unwrap();
    (dir, path)
}

fn default() -> Value {
    json!({
        "version": 1,
        "policy": {"deny_transparent": true},
        "transitions": [{
            "name": "creator-to-updater",
            "before": "00-created.bin",
            "after": "01-updated.bin",
            "expect": {
                "passed": false,
                "added_rules": ["PCZT-GLOBAL-METADATA"],
                "resolved_rules": [],
                "changed_components": []
            }
        }]
    })
}

#[test]
fn checked_in_role_scenario_uses_real_upstream_pczt() {
    let output = run(&root().join("tests/fixtures/role-handoff/scenario.json"));
    assert_eq!(output.status.code(), Some(0));
    let decoded: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(decoded["scenario_count"], 4);
    assert_eq!(decoded["matched"], 4);
    assert_eq!(decoded["passed"], true);
    assert!(!String::from_utf8_lossy(&output.stdout).contains("synthetic-marker-NEVER-SHOW"));
}

#[test]
fn failed_scenario_expectation_is_a_distinct_exit_code() {
    let mut scenario = default();
    scenario["transitions"][0]["expect"]["passed"] = json!(true);
    let (dir, path) = manifest(scenario);
    let output = run(&path);
    assert_eq!(output.status.code(), Some(2));
    let decoded: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(decoded["passed"], false);
    assert_eq!(decoded["cases"][0]["matched_expectation"], false);
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn rejects_directory_traversal_or_unapproved_filenames() {
    let mut scenario = default();
    scenario["transitions"][0]["before"] = json!("../sensitive-wallet.bin");
    let (dir, path) = manifest(scenario);
    let output = run(&path);
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn rejects_unknown_manifest_keys_without_echoing_values() {
    let mut scenario = default();
    scenario["synthetic_sensitive_marker"] = json!("SYNTHETIC_NOT_WALLET_DATA");
    let (dir, path) = manifest(scenario);
    let output = run(&path);
    assert_eq!(output.status.code(), Some(1));
    assert!(!String::from_utf8_lossy(&output.stderr).contains("SYNTHETIC_NOT_WALLET_DATA"));
    fs::remove_dir_all(dir).unwrap();
}

#[cfg(unix)]
#[test]
fn rejects_symlink_fixture() {
    use std::os::unix::fs::symlink;
    let mut scenario = default();
    scenario["transitions"][0]["before"] = json!("linked.bin");
    let (dir, path) = manifest(scenario);
    symlink(dir.join("00-created.bin"), dir.join("linked.bin")).unwrap();
    let output = run(&path);
    assert_eq!(output.status.code(), Some(1));
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn rejects_empty_or_unexpected_scenario_version() {
    let mut scenario = default();
    scenario["version"] = json!(99);
    let (dir, path) = manifest(scenario);
    let output = run(&path);
    assert_eq!(output.status.code(), Some(1));
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn refuses_invalid_pczt_fixture_with_sanitized_error() {
    let (dir, path) = manifest(default());
    fs::write(dir.join("01-updated.bin"), b"SYNTHETIC_WALLET_TEST_MARKER").unwrap();
    let output = run(&path);
    assert_eq!(output.status.code(), Some(1));
    assert!(!String::from_utf8_lossy(&output.stderr).contains("SYNTHETIC_WALLET_TEST_MARKER"));
    fs::remove_dir_all(dir).unwrap();
}
