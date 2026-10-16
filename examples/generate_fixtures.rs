//! Generates two deterministic non-spendable v6 PCZT test fixtures.
use pczt::roles::{creator::Creator, updater::Updater};
use std::{fs, path::Path};
fn main() {
    let base = Creator::new(0x37a5_165b, 0, 133, None, None)
        .expect("NU6.3 branch recognized")
        .build()
        .expect("create empty v6 PCZT");
    let safe = base.clone().serialize().expect("encode clean fixture");
    let flagged = Updater::new(base)
        .update_global_with(|mut global| {
            global.set_proprietary(
                "example-synthetic-marker".into(),
                b"synthetic-only".to_vec(),
            );
        })
        .finish()
        .serialize()
        .expect("encode flagged fixture");
    let path = Path::new("apps/web/public/examples");
    fs::create_dir_all(path).unwrap();
    fs::write(path.join("clean-v6.bin"), safe).unwrap();
    fs::write(path.join("flagged-v6.bin"), flagged).unwrap();
    println!("Generated safe & flagged synthetic PCZT v6 test fixtures");
}
