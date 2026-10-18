use std::{
    io::Write,
    process::{Command, Stdio},
};
const TESTNET: &str = "tmEZhbWHTpdKMw5it8YDspUXSMGQyFwovpU";

fn run(input: &str, network: &str) -> (i32, String, String) {
    let mut child = Command::new(env!("CARGO_BIN_EXE_zerynex-payreq"))
        .arg("--network")
        .arg(network)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    child
        .stdin
        .take()
        .unwrap()
        .write_all(input.as_bytes())
        .unwrap();
    let done = child.wait_with_output().unwrap();
    (
        done.status.code().unwrap(),
        String::from_utf8(done.stdout).unwrap(),
        String::from_utf8(done.stderr).unwrap(),
    )
}

#[test]
fn accepts_testnet_request_and_omits_recipient_and_message() {
    let uri = format!("zcash:{TESTNET}?amount=1.25&message=PRIVATE_TEST_MARKER");
    let (status, stdout, stderr) = run(&uri, "test");
    assert_eq!(status, 0);
    let json: serde_json::Value = serde_json::from_str(&stdout).unwrap();
    assert_eq!(json["total_zat"], 125_000_000);
    assert_eq!(json["payments"][0]["address_type"], "transparent");
    assert!(!stdout.contains(TESTNET) && !stdout.contains("PRIVATE_TEST_MARKER"));
    assert!(stderr.is_empty());
    let (status, stdout, stderr) = run(&uri, "main");
    assert_eq!(status, 1);
    assert!(stdout.is_empty() && !stderr.contains(TESTNET));
}

#[test]
fn malformed_or_unsupported_requests_fail_with_redacted_errors() {
    let invalid = [
        format!("zcash:{TESTNET}?req-wallet-sign=1&message=PRIVATE_TEST_MARKER"),
        format!("zcash:{TESTNET}?memo=AA"),
        format!("zcash:{TESTNET}?amount=1&amount=2"),
    ];
    for uri in invalid {
        let (status, stdout, stderr) = run(&uri, "test");
        assert_eq!(status, 1);
        assert!(
            stdout.is_empty()
                && !stderr.contains(TESTNET)
                && !stderr.contains("PRIVATE_TEST_MARKER")
        );
    }
}
