//! Node-free synthetic PCZT role-handoff acceptance scenarios.
//! No wallet RPC, signing, proving, broadcast, or arbitrary path access.
use clap::Parser;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::ExitCode,
};
use zerynex::{compare_stages_with_policy, PolicyConfig};

const MAX_FILE_BYTES: u64 = 8 * 1024 * 1024;
const MAX_MANIFEST_BYTES: u64 = 32 * 1024;

#[derive(Parser)]
#[command(
    name = "zerynex-handoff",
    version,
    about = "Run synthetic PCZT role-handoff policy scenarios without a node"
)]
struct Args {
    /// JSON manifest containing only approved synthetic fixture names.
    #[arg(long)]
    manifest: PathBuf,
    /// Emit a sanitized, machine-readable acceptance report.
    #[arg(long)]
    json: bool,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    version: u8,
    #[serde(default)]
    policy: PolicyConfig,
    transitions: Vec<Transition>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Transition {
    name: String,
    before: String,
    after: String,
    expect: Expectation,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
struct Expectation {
    /// Expect a clean comparison; false allows intentionally unsafe fixture stages.
    passed: bool,
    /// The expected newly introduced disclosure rule IDs.
    added_rules: Vec<String>,
    /// Expected removed disclosure rule IDs.
    resolved_rules: Vec<String>,
    /// Component names whose number of components changed.
    changed_components: Vec<String>,
}

#[derive(Debug, Serialize)]
struct TestCase {
    name: String,
    matched_expectation: bool,
    policy_passed: bool,
    added_rules: Vec<&'static str>,
    resolved_rules: Vec<&'static str>,
    changed_components: Vec<&'static str>,
}
#[derive(Debug, Serialize)]
struct ScenarioResult {
    version: u8,
    scenario_count: usize,
    matched: usize,
    passed: bool,
    cases: Vec<TestCase>,
    limitation: &'static str,
}

fn safe_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 80
        && name.is_ascii()
        && name
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, b'-' | b'_' | b'.'))
        && !matches!(name, "." | "..")
        && !name.starts_with('.')
}

fn read_fixture(root: &Path, name: &str) -> Result<Vec<u8>, &'static str> {
    if !safe_name(name) || !name.ends_with(".bin") {
        return Err("Invalid fixture name; simple .bin filenames only");
    }
    let file = root.join(name);
    let metadata = fs::symlink_metadata(&file).map_err(|_| "Cannot open a scenario fixture")?;
    if metadata.file_type().is_symlink()
        || !metadata.file_type().is_file()
        || metadata.len() == 0
        || metadata.len() > MAX_FILE_BYTES
    {
        return Err("Scenario fixtures must be nonempty regular files no larger than 8 MiB");
    }
    fs::read(file).map_err(|_| "Cannot read a scenario fixture")
}

fn run(args: Args) -> Result<ExitCode, &'static str> {
    let manifest_metadata =
        fs::symlink_metadata(&args.manifest).map_err(|_| "Cannot open scenario manifest")?;
    if !manifest_metadata.is_file()
        || manifest_metadata.file_type().is_symlink()
        || manifest_metadata.len() == 0
        || manifest_metadata.len() > MAX_MANIFEST_BYTES
    {
        return Err("Invalid scenario manifest size or file type");
    }
    let data = fs::read_to_string(&args.manifest).map_err(|_| "Cannot read scenario manifest")?;
    let manifest: Manifest = serde_json::from_str(&data).map_err(|_| "Invalid scenario JSON")?;
    if manifest.version != 1 || manifest.transitions.is_empty() || manifest.transitions.len() > 32 {
        return Err("Unsupported scenario version or transition count");
    }
    let root = args
        .manifest
        .canonicalize()
        .map_err(|_| "Cannot locate scenario folder")?;
    let root = root.parent().ok_or("Scenario folder is invalid")?;
    let mut cases = Vec::with_capacity(manifest.transitions.len());
    for transition in manifest.transitions {
        if !safe_name(&transition.name)
            || transition.expect.added_rules.len() > 100
            || transition.expect.resolved_rules.len() > 100
            || transition.expect.changed_components.len() > 6
        {
            return Err("Invalid scenario expectation");
        }
        let before = read_fixture(root, &transition.before)?;
        let after = read_fixture(root, &transition.after)?;
        let report = compare_stages_with_policy(&before, &after, manifest.policy)?;
        let added_rules: Vec<_> = report.added_findings.iter().map(|f| f.rule).collect();
        let resolved_rules: Vec<_> = report.resolved_findings.iter().map(|f| f.rule).collect();
        let changed_components: Vec<_> = report
            .component_deltas
            .iter()
            .map(|f| f.component)
            .collect();
        let mut added_expected: Vec<_> = transition
            .expect
            .added_rules
            .iter()
            .map(String::as_str)
            .collect();
        let mut resolved_expected: Vec<_> = transition
            .expect
            .resolved_rules
            .iter()
            .map(String::as_str)
            .collect();
        let mut changed_expected: Vec<_> = transition
            .expect
            .changed_components
            .iter()
            .map(String::as_str)
            .collect();
        added_expected.sort_unstable();
        resolved_expected.sort_unstable();
        changed_expected.sort_unstable();
        let mut added_actual = added_rules.clone();
        let mut resolved_actual = resolved_rules.clone();
        let mut changed_actual = changed_components.clone();
        added_actual.sort_unstable();
        resolved_actual.sort_unstable();
        changed_actual.sort_unstable();
        let matched_expectation = report.passed == transition.expect.passed
            && added_actual == added_expected
            && resolved_actual == resolved_expected
            && changed_actual == changed_expected;
        cases.push(TestCase {
            name: transition.name,
            matched_expectation,
            policy_passed: report.passed,
            added_rules,
            resolved_rules,
            changed_components,
        });
    }
    let matched = cases.iter().filter(|case| case.matched_expectation).count();
    let result = ScenarioResult {
        version: 1,
        scenario_count: cases.len(),
        matched,
        passed: matched == cases.len(),
        cases,
        limitation: "Synthetic PCZT role checks only: no node, signatures, proofs, transaction equivalence or wallet RPC validated.",
    };
    if args.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&result).map_err(|_| "Cannot encode scenario result")?
        );
    } else {
        println!(
            "Zerynex role-handoff scenarios: {}/{} matched expected disclosure behavior",
            result.matched, result.scenario_count
        );
        for case in result.cases {
            println!(
                "{}: expectation {} (policy_passed: {})",
                case.name,
                if case.matched_expectation {
                    "MATCH"
                } else {
                    "MISMATCH"
                },
                case.policy_passed
            );
        }
    }
    Ok(if result.passed {
        ExitCode::SUCCESS
    } else {
        ExitCode::from(2)
    })
}

fn main() -> ExitCode {
    match run(Args::parse()) {
        Ok(code) => code,
        Err(message) => {
            eprintln!("Zerynex handoff: {message}");
            ExitCode::from(1)
        }
    }
}
