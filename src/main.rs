use clap::{Parser, ValueEnum};
use std::{fs, path::PathBuf, process::ExitCode};
use zerynex::{analyze_with_policy, parse_policy_json, PolicyConfig, Profile};

#[derive(Parser)]
#[command(
    name = "zerynex",
    version,
    about = "Local PCZT disclosure-policy checks for Zcash"
)]
struct Args {
    /// Binary PCZT file, processed locally.
    file: PathBuf,
    /// Built-in policy profile. Mutually exclusive with --policy-file.
    #[arg(long, value_enum, conflicts_with = "policy_file")]
    profile: Option<Policy>,
    /// Local JSON policy file; strict schema, max 4 KiB.
    #[arg(long)]
    policy_file: Option<PathBuf>,
    /// Flag any transparent transaction components.
    #[arg(long)]
    deny_transparent: bool,
    /// Flag any Sapling spend or output components.
    #[arg(long)]
    deny_sapling: bool,
    #[arg(long)]
    json: bool,
}
#[derive(Clone, Copy, ValueEnum)]
enum Policy {
    ExternalSigner,
    RestrictedHandoff,
}
fn load_policy(args: &Args) -> Result<PolicyConfig, &'static str> {
    let mut policy = if let Some(path) = &args.policy_file {
        let metadata = fs::metadata(path).map_err(|_| "Cannot read policy file")?;
        if !metadata.is_file() || metadata.len() > 4096 {
            return Err("Expected a JSON policy file of at most 4 KiB");
        }
        let contents = fs::read_to_string(path).map_err(|_| "Cannot read policy file")?;
        parse_policy_json(&contents)?
    } else {
        PolicyConfig {
            profile: match args.profile.unwrap_or(Policy::ExternalSigner) {
                Policy::ExternalSigner => Profile::ExternalSigner,
                Policy::RestrictedHandoff => Profile::RestrictedHandoff,
            },
            ..PolicyConfig::default()
        }
    };
    policy.deny_transparent |= args.deny_transparent;
    policy.deny_sapling |= args.deny_sapling;
    Ok(policy)
}
fn run() -> Result<ExitCode, &'static str> {
    let args = Args::parse();
    let policy = load_policy(&args)?;
    let info = fs::metadata(&args.file).map_err(|_| "Cannot read PCZT file")?;
    if !info.is_file() || info.len() > 8 * 1024 * 1024 {
        return Err("Expected a regular PCZT file no larger than 8 MiB");
    }
    let bytes = fs::read(&args.file).map_err(|_| "Cannot read PCZT file")?;
    let report = analyze_with_policy(&bytes, policy)?;
    if args.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&report).map_err(|_| "Cannot encode report")?
        );
    } else {
        println!(
            "Zerynex: {} finding(s) | profile: {} | transparent denied: {} | Sapling denied: {}",
            report.findings.len(),
            report.profile,
            report.deny_transparent,
            report.deny_sapling
        );
        for f in &report.findings {
            println!("{} at {}: {}", f.rule, f.field, f.explanation);
        }
    }
    Ok(if report.passed() {
        ExitCode::SUCCESS
    } else {
        ExitCode::from(2)
    })
}
fn main() -> ExitCode {
    match run() {
        Ok(status) => status,
        Err(message) => {
            eprintln!("Zerynex: {message}");
            ExitCode::from(1)
        }
    }
}
