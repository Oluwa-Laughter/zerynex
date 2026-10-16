//! Deterministic PCZT 0.9.3 role test vectors; never spendable, no proofs/keys.
//! These test Creator, Updater, Combiner and Redactor roles, not Zallet RPC.
use pczt::roles::{combiner::Combiner, creator::Creator, redactor::Redactor, updater::Updater};
use std::{fs, path::Path};

fn main() {
    let dir = Path::new("tests/fixtures/role-handoff");
    let args: Vec<String> = std::env::args().skip(1).collect();
    let check_only = match args.as_slice() {
        [flag] if flag == "--check" => true,
        [] => false,
        _ => panic!("Only the --check flag is accepted"),
    };
    if !check_only {
        fs::create_dir_all(dir).expect("create fixture directory");
    }
    let created = Creator::new(0x37a5_165b, 0, 133, None, None)
        .expect("supported consensus branch")
        .build()
        .expect("create synthetic v6 PCZT");
    let updated = Updater::new(created.clone())
        .update_global_with(|mut global| {
            global.set_proprietary(
                "fixture-opaque-annotation".to_owned(),
                b"synthetic-marker-NEVER-SHOW".to_vec(),
            );
        })
        .finish();
    let combined = Combiner::new(vec![created.clone(), updated.clone()])
        .combine()
        .expect("combine matching transaction roles");
    let redacted = Redactor::new(combined.clone())
        .redact_global_with(|mut global| global.clear_proprietary())
        .finish();

    let stages = [
        ("00-created.bin", created),
        ("01-updated.bin", updated),
        ("02-combined.bin", combined),
        ("03-redacted.bin", redacted),
    ];
    for (name, pczt) in stages {
        let encoded = pczt.serialize().expect("serialize synthetic v6 PCZT");
        pczt::Pczt::parse(&encoded).expect("check upstream PCZT roundtrip");
        if check_only {
            assert_eq!(
                fs::read(dir.join(name)).expect("checked-in fixture missing"),
                encoded,
                "synthetic role fixture is not reproducible: {name}"
            );
        } else {
            fs::write(dir.join(name), encoded).expect("write synthetic fixture");
        }
    }
    println!("Four synthetic role fixtures verified without signing or proving.");
}
