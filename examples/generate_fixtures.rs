//! Generate deterministic, non-spendable PCZT v6 test fixtures.
//! These are intermediate transaction examples only, not valid payments.
use pczt::roles::{creator::Creator, updater::Updater};
use std::{fs, path::Path};

fn main() {
    let base = Creator::new(0x37a5_165b, 0, 133, None, None)
        .expect("NU6.3 branch recognized")
        .build()
        .expect("create empty v6 PCZT");
    let safe = base.clone().serialize().expect("encode clean fixture");
    let flagged = Updater::new(base.clone())
        .update_global_with(|mut global| {
            global.set_proprietary(
                "example-synthetic-marker".into(),
                b"synthetic-only".to_vec(),
            );
        })
        .finish()
        .serialize()
        .expect("encode flagged fixture");

    // Construct an intentionally non-spendable synthetic transparent-output PCZT
    // through the upstream versioned serialization type, so it exercises the
    // parser and disclosure engine without introducing wallet secrets.
    let v2 = pczt::v2::Pczt::try_from(base).expect("convert to v2 PCZT");
    let mut value = serde_json::to_value(v2).expect("serialize synthetic PCZT");
    value["transparent"] = serde_json::json!({
        "inputs": [],
        "outputs": [{
            "value": 123,
            "script_pubkey": [],
            "redeem_script": null,
            "bip32_derivation": {},
            "user_address": null,
            "proprietary": {}
        }]
    });
    let transparent_v2: pczt::v2::Pczt =
        serde_json::from_value(value).expect("build synthetic transparent output");
    let transparent = transparent_v2.serialize();
    pczt::Pczt::parse(&transparent).expect("parse generated transparent PCZT");

    let path = Path::new("apps/web/public/examples");
    fs::create_dir_all(path).unwrap();
    fs::write(path.join("clean-v6.bin"), safe).unwrap();
    fs::write(path.join("flagged-v6.bin"), flagged).unwrap();
    fs::write(path.join("transparent-v6.bin"), transparent).unwrap();
    println!("Generated clean, metadata-flagged, and transparent synthetic PCZT v6 fixtures");
}
