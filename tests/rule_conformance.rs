//! Shared synthetic rule vectors exercised through the published CLI contract.
//! All bytes are deliberately nonspendable and generated offline by pczt 0.9.3.
use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeSet;
use std::{path::PathBuf, process::Command};

#[derive(Debug, Deserialize)]
struct Manifest {
    schema_version: u32,
    rule_set_version: String,
    cases: Vec<Case>,
}
#[derive(Debug, Deserialize)]
struct Case {
    fixture: String,
    profile: String,
    deny_transparent: bool,
    deny_sapling: bool,
    findings: Vec<ExpectedFinding>,
}
#[derive(Debug, Deserialize, PartialEq, Eq, Ord, PartialOrd)]
struct ExpectedFinding {
    rule: String,
    field: String,
}
fn root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}
fn manifest() -> Manifest {
    serde_json::from_slice(
        &std::fs::read(root().join("tests/fixtures/rules/expectations.json")).unwrap(),
    )
    .unwrap()
}
fn filename(name: &str) -> PathBuf {
    assert!(name.ends_with(".bin") && !name.contains('/') && !name.contains('\\'));
    let source = if matches!(
        name,
        "clean-v6.bin" | "flagged-v6.bin" | "transparent-v6.bin"
    ) {
        "apps/web/public/examples"
    } else {
        "tests/fixtures/rules"
    };
    root().join(source).join(name)
}
fn execute(case: &Case, output_type: &str) -> (i32, Value, String) {
    let mut cmd = Command::new(env!("CARGO_BIN_EXE_zerynex"));
    cmd.arg(filename(&case.fixture))
        .arg(output_type)
        .arg("--profile")
        .arg(case.profile.replace('_', "-"));
    if case.deny_transparent {
        cmd.arg("--deny-transparent");
    }
    if case.deny_sapling {
        cmd.arg("--deny-sapling");
    }
    let output = cmd.output().unwrap();
    let status = output.status.code().unwrap();
    let stdout = String::from_utf8(output.stdout).unwrap();
    let json = serde_json::from_str(&stdout)
        .unwrap_or_else(|_| panic!("missing structured report for {}", case.fixture));
    (status, json, stdout)
}

#[test]
fn every_implemented_analysis_rule_has_a_reproducible_vector() {
    let dataset = manifest();
    assert_eq!(dataset.schema_version, 1);
    assert_eq!(
        dataset.rule_set_version,
        zerynex::rules::rule_catalog().rule_set_version
    );
    assert_eq!(dataset.cases.len(), 18);
    let expected: BTreeSet<_> = zerynex::rules::rule_catalog()
        .rules
        .iter()
        .filter(|rule| rule.applies_to.contains(&"analysis".to_owned()))
        .map(|rule| rule.id.as_str())
        .collect();
    let mut covered = BTreeSet::new();
    for case in &dataset.cases {
        let expected_findings: BTreeSet<_> = case.findings.iter().collect();
        assert_eq!(
            expected_findings.len(),
            case.findings.len(),
            "Duplicate assertion: {}",
            case.fixture
        );
        for finding in &case.findings {
            covered.insert(finding.rule.as_str());
            assert!(zerynex::rules::find_rule(&finding.rule).is_some());
        }
    }
    assert_eq!(
        covered, expected,
        "Every analysis rule requires a tested fixture"
    );
}

#[test]
fn cli_json_sarif_and_exit_codes_conform_for_every_fixture() {
    let registry = zerynex::rules::rule_catalog();
    let defined: BTreeSet<_> = registry.rules.iter().map(|item| item.id.as_str()).collect();
    for case in manifest().cases {
        let (status, report, plain) = execute(&case, "--json");
        let want = if case.findings.is_empty() { 0 } else { 2 };
        assert_eq!(status, want, "{}: incorrect exit", case.fixture);
        assert_eq!(report["profile"], case.profile);
        assert_eq!(report["deny_transparent"], case.deny_transparent);
        assert_eq!(report["deny_sapling"], case.deny_sapling);
        let actual: Vec<ExpectedFinding> = serde_json::from_value(
            report["findings"]
                .as_array()
                .unwrap()
                .iter()
                .map(|item| serde_json::json!({"rule":item["rule"],"field":item["field"]}))
                .collect::<Value>(),
        )
        .unwrap();
        assert_eq!(
            actual, case.findings,
            "{}: wrong rules or structural paths",
            case.fixture
        );
        assert!(
            !plain.contains("synthetic-marker")
                && !plain.contains("example-synthetic-not-a-real-address"),
            "no raw fixture values in reports"
        );
        let (sarif_status, sarif, sarif_text) = execute(&case, "--sarif");
        assert_eq!(sarif_status, status);
        assert_eq!(sarif["version"], "2.1.0");
        assert_eq!(
            sarif["runs"][0]["properties"]["zerynexPassed"],
            case.findings.is_empty()
        );
        let catalog_ids: BTreeSet<_> = sarif["runs"][0]["tool"]["driver"]["rules"]
            .as_array()
            .unwrap()
            .iter()
            .map(|rule| rule["id"].as_str().unwrap())
            .collect();
        assert_eq!(catalog_ids, defined);
        let sarif_findings: Vec<ExpectedFinding> = sarif["runs"][0]["results"]
            .as_array()
            .unwrap()
            .iter()
            .map(|result| ExpectedFinding {
                rule: result["ruleId"].as_str().unwrap().to_owned(),
                field: result["properties"]["pczt_field"]
                    .as_str()
                    .unwrap()
                    .to_owned(),
            })
            .collect();
        assert_eq!(sarif_findings, case.findings);
        assert!(
            !sarif_text.contains("physicalLocation") && !sarif_text.contains("artifactLocation")
        );
        assert!(
            !sarif_text.contains("synthetic-marker")
                && !sarif_text.contains("example-synthetic-not-a-real-address")
        );
        assert!(
            !sarif_text.contains(case.fixture.as_str()),
            "SARIF must not reveal original fixture paths"
        );
    }
}

#[test]
fn stage_regressions_obey_same_shared_manifest_as_python_and_browser_sdk() {
    let cases: Value = serde_json::from_slice(
        &std::fs::read(root().join("tests/fixtures/rules/expectations.json")).unwrap(),
    )
    .unwrap();
    let stages = cases["stage_cases"].as_array().unwrap();
    assert_eq!(stages.len(), 7);
    for scenario in stages {
        let before = scenario["before"].as_str().unwrap();
        let after = scenario["after"].as_str().unwrap();
        let profile = scenario["profile"].as_str().unwrap().replace('_', "-");
        let mut cmd = Command::new(env!("CARGO_BIN_EXE_zerynex"));
        cmd.arg(filename(before))
            .arg("--compare-with")
            .arg(filename(after))
            .arg("--profile")
            .arg(&profile)
            .arg("--json");
        if scenario["deny_transparent"] == true {
            cmd.arg("--deny-transparent");
        }
        if scenario["deny_sapling"] == true {
            cmd.arg("--deny-sapling");
        }
        let out = cmd.output().unwrap();
        let json: Value = serde_json::from_slice(&out.stdout).unwrap();
        let status = if scenario["passed"] == true { 0 } else { 2 };
        assert_eq!(out.status.code(), Some(status), "{}", scenario["name"]);
        for field in [
            "added_findings",
            "resolved_findings",
            "component_deltas",
            "no_new_findings",
            "passed",
        ] {
            assert_eq!(
                json[field], scenario[field],
                "{}: {field}",
                scenario["name"]
            );
        }
        let mut sarif_cmd = Command::new(env!("CARGO_BIN_EXE_zerynex"));
        sarif_cmd
            .arg(filename(before))
            .arg("--compare-with")
            .arg(filename(after))
            .arg("--profile")
            .arg(&profile)
            .arg("--sarif");
        if scenario["deny_transparent"] == true {
            sarif_cmd.arg("--deny-transparent");
        }
        if scenario["deny_sapling"] == true {
            sarif_cmd.arg("--deny-sapling");
        }
        let result = sarif_cmd.output().unwrap();
        assert_eq!(result.status.code(), out.status.code());
        let sarif: Value = serde_json::from_slice(&result.stdout).unwrap();
        assert_eq!(sarif["runs"][0]["properties"]["stageComparison"], true);
        assert_eq!(
            sarif["runs"][0]["properties"]["zerynexPassed"],
            scenario["passed"]
        );
        let drift = sarif["runs"][0]["results"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|x| x["ruleId"] == "PCZT-STRUCTURE-DRIFT")
            .count();
        assert_eq!(
            drift,
            scenario["component_deltas"].as_array().unwrap().len()
        );
        let payload = String::from_utf8(result.stdout).unwrap();
        assert!(!payload.contains(before) && !payload.contains(after));
        assert!(!payload.contains("physicalLocation") && !payload.contains("artifactLocation"));
    }
}
