use clap::{Parser, ValueEnum};
use std::{fs, path::PathBuf, process::ExitCode};
use zerynex::{analyze, Profile};
#[derive(Parser)]
#[command(
    name = "zerynex",
    version,
    about = "Local PCZT privacy-policy analysis for Zcash"
)]
struct Args {
    file: PathBuf,
    #[arg(long, value_enum, default_value_t = Policy::ExternalSigner)]
    profile: Policy,
    #[arg(long)]
    json: bool,
}
#[derive(Clone, Copy, ValueEnum)]
enum Policy {
    ExternalSigner,
    RestrictedHandoff,
}
fn run() -> Result<ExitCode, &'static str> {
    let args = Args::parse();
    let info = fs::metadata(&args.file).map_err(|_| "Cannot read PCZT file")?;
    if !info.is_file() || info.len() > 8 * 1024 * 1024 {
        return Err("Expected a regular PCZT file no larger than 8 MiB");
    }
    let bytes = fs::read(&args.file).map_err(|_| "Cannot read PCZT file")?;
    let profile = match args.profile {
        Policy::ExternalSigner => Profile::ExternalSigner,
        Policy::RestrictedHandoff => Profile::RestrictedHandoff,
    };
    let report = analyze(&bytes, profile)?;
    if args.json {
        println!(
            "{}",
            serde_json::to_string_pretty(&report).map_err(|_| "Cannot encode report")?
        );
    } else {
        println!(
            "Zerynex: {} finding(s) | {}",
            report.findings.len(),
            report.profile
        );
        for f in &report.findings {
            println!("{} at {}: {}", f.rule, f.field, f.explanation);
        }
    }
    Ok(if report.findings.is_empty() {
        ExitCode::SUCCESS
    } else {
        ExitCode::from(2)
    })
}
fn main() -> ExitCode {
    match run() {
        Ok(code) => code,
        Err(message) => {
            eprintln!("Zerynex: {message}");
            ExitCode::from(1)
        }
    }
}
