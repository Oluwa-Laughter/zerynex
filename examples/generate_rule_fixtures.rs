//! Nonspendable, deterministic PCZT 0.9.3 rule vectors. Never wallet data.
use pczt::roles::creator::Creator;
use serde_json::{json, Value};
use std::{fs, path::Path};

fn encode(mut root: Value, bundle: &str, content: Value) -> Vec<u8> {
    root[bundle] = content;
    let serialized: pczt::v2::Pczt =
        serde_json::from_value(root).expect("synthetic structural fixture");
    let bytes = serialized.serialize();
    pczt::Pczt::parse(&bytes).expect("fixture passes upstream format parsing");
    bytes
}
fn output(proprietary: bool, address: bool) -> Value {
    json!({
        "value": 123,
        "script_pubkey": [],
        "redeem_script": null,
        "bip32_derivation": {},
        "user_address": if address {Some("example-synthetic-not-a-real-address")} else {None},
        "proprietary": if proprietary { json!({"synthetic-marker": [88, 89]}) } else { json!({}) },
    })
}
fn input(proprietary: bool) -> Value {
    json!({
        "prevout_txid": vec![0u8;32], "prevout_index": 0,
        "sequence": null, "required_time_lock_time": null,
        "required_height_lock_time": null, "script_sig": null,
        "value": 0, "script_pubkey": [], "redeem_script": null,
        "partial_signatures": {}, "sighash_type": 1,
        "bip32_derivation": {}, "ripemd160_preimages": {},
        "sha256_preimages": {}, "hash160_preimages": {}, "hash256_preimages": {},
        "proprietary": if proprietary {json!({"synthetic-marker": [88, 89]})} else {json!({})},
    })
}
fn sapling_output() -> Value {
    json!({
        "cv": vec![0u8;32], "cmu": vec![0u8;32], "ephemeral_key": vec![0u8;32],
        "enc_ciphertext": [], "out_ciphertext": [], "zkproof": null,
        "recipient": null, "value": 0, "rseed": null,
        "rcv": null, "ock": null, "zip32_derivation": null,
        "user_address": null, "proprietary": {},
    })
}
fn orchard_action(dummy: bool, metadata: bool, restricted: bool) -> Value {
    json!({
        "cv_net": null,
        "spend": {
            "nullifier": vec![0u8;32], "rk": vec![0u8;32],
            "spend_auth_sig": null, "recipient": null, "value": null,
            "rho": null, "rseed": null, "fvk": null, "witness": null,
            "alpha": null, "zip32_derivation": null,
            // All-zero bytes are a deliberate nonspendable sentinel, not a wallet key.
            // This fixture must never be used for constructing live transactions.
            "dummy_sk": if dummy {Some(vec![0u8;32])} else {None},
            "proprietary": if metadata {json!({"synthetic-marker": [88,89]})} else {json!({})},
        },
        "output": {
            "cmx": null, "ephemeral_key": vec![0u8;32],
            "enc_ciphertext": {"Encrypted": []}, "out_ciphertext": [],
            "recipient": null, "value": if restricted {Some(0u64)} else {None},
            "rseed": null, "ock": null, "zip32_derivation": null,
            "user_address": null, "proprietary": {},
        },
        "rcv": null,
    })
}
fn orchard_bundle(dummy: bool, metadata: bool, restricted: bool) -> Value {
    json!({
        "actions": [orchard_action(dummy, metadata, restricted)],
        "flags": 0, "value_sum": [0,false],
        "anchor": null, "note_version": "V3", "zkproof": null, "bsk": null,
    })
}
fn main() {
    let base = Creator::new(0x37a5_165b, 0, 133, None, None)
        .expect("NU6.3 branch known")
        .build()
        .expect("empty synthetic PCZT");
    let root = serde_json::to_value(pczt::v2::Pczt::try_from(base).unwrap()).unwrap();
    let cases = [
        (
            "transparent-inputs.bin",
            encode(
                root.clone(),
                "transparent",
                json!({"inputs": [input(false)], "outputs": []}),
            ),
        ),
        (
            "transparent-input-metadata.bin",
            encode(
                root.clone(),
                "transparent",
                json!({"inputs": [input(true)], "outputs": []}),
            ),
        ),
        (
            "transparent-output-metadata.bin",
            encode(
                root.clone(),
                "transparent",
                json!({"inputs": [], "outputs": [output(true, false)]}),
            ),
        ),
        (
            "restricted-transparent-output.bin",
            encode(
                root.clone(),
                "transparent",
                json!({"inputs": [], "outputs": [output(false, true)]}),
            ),
        ),
        (
            "orchard-dummy-key.bin",
            encode(root.clone(), "orchard", orchard_bundle(true, false, false)),
        ),
        (
            "orchard-spend-metadata.bin",
            encode(root.clone(), "orchard", orchard_bundle(false, true, false)),
        ),
        (
            "orchard-restricted-output.bin",
            encode(root.clone(), "orchard", orchard_bundle(false, false, true)),
        ),
        (
            "sapling-output.bin",
            encode(
                root,
                "sapling",
                json!({
                    "spends": [], "outputs": [sapling_output()],
                    "value_sum": 0, "anchor": null, "bsk": null,
                }),
            ),
        ),
    ];
    let output = Path::new("tests/fixtures/rules");
    let check = match std::env::args().skip(1).collect::<Vec<_>>().as_slice() {
        [] => false,
        [arg] if arg == "--check" => true,
        _ => panic!("only --check accepted"),
    };
    if !check {
        fs::create_dir_all(output).unwrap()
    }
    for (name, bytes) in cases {
        if check {
            assert_eq!(
                fs::read(output.join(name)).expect("missing fixture"),
                bytes,
                "{name} changed"
            )
        } else {
            fs::write(output.join(name), bytes).unwrap()
        }
    }
    println!("Verified 8 synthetic rule vectors (no real secrets, witnesses, or signing material)");
}
