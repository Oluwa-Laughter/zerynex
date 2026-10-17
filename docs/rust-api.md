# Rust library API

Zerynex's Rust library implements the canonical local PCZT disclosure-policy analysis. It uses the Zcash ecosystem's `pczt` crate to parse transaction intermediates. The library does **not** create, sign, prove, extract or broadcast Zcash transactions.

## Integrate from source

Before a crates.io release, use a reviewed, pinned commit of this repository in `Cargo.toml`:

```toml
[dependencies]
zerynex = { git = "https://github.com/Oluwa-Laughter/zerynex", rev = "<reviewed-commit-sha>" }
```

Replace the placeholder with a real, reviewed commit. The library requires a compatible Rust toolchain and is available directly from source; a crates.io publication is not yet guaranteed.

## Analyze PCZT bytes

```rust
use zerynex::{analyze_with_policy, PolicyConfig, Profile};

fn inspect(local_pczt: &[u8]) -> Result<(), &'static str> {
    let policy = PolicyConfig {
        profile: Profile::ExternalSigner,
        deny_transparent: true,
        deny_sapling: false,
    };
    let report = analyze_with_policy(local_pczt, policy)?;
    for finding in &report.findings {
        eprintln!("{} at {}", finding.rule, finding.field);
    }
    if !report.passed() {
        return Err("PCZT disclosure-policy findings require review");
    }
    Ok(())
}
```

Pass PCZT bytes from a trusted **local** process. Neither the library nor its `Report` is signing authorization. Do not serialize or log transaction bytes.

## Library interfaces

| API | Description |
| --- | --- |
| `parse_policy_json(&str)` | Parse a strict policy configuration; maximum 4 KiB |
| `analyze(bytes, Profile)` | Parse bytes, apply default flags for the selected profile |
| `analyze_with_policy(bytes, PolicyConfig)` | Parse bytes and evaluate explicit field/pool restrictions |
| `analyze_parsed(&Pczt, Profile)` | Evaluate an already parsed PCZT with selected profile |
| `analyze_parsed_with_policy(&Pczt, PolicyConfig)` | Analyze with a typed policy and no additional parse |
| `compare_stages_with_policy(...)` | Compare supported disclosure findings and component counts across stages |

For the exact `compare_stages_with_policy` argument types, consult the public Rust source at `src/lib.rs` until generated rustdoc is published. Read [Policy format](policy-format.md) and [Reports and error semantics](report-reference.md) for the current contract.

## Interpretation

A clean report means **selected fields** were not flagged in this PCZT. It is not proof validity, anonymity, transaction equivalence or authorization to spend. The Sapling field coverage is explicitly partial; upstream private fields without public getters are outside this release's checks. Use [Stage regression testing](pczt-stage-regression.md) for handoff workflows.
