use base64::{engine::general_purpose::STANDARD, Engine as _};
use clap::{Parser, ValueEnum};
use std::{
    fs,
    io::{self, Read},
    path::PathBuf,
    process::ExitCode,
};
use zerynex::{analyze_with_policy, parse_policy_json, PolicyConfig, Profile};

#[derive(Parser)]
#[command(
    name = "zerynex",
    version,
    about = "Local PCZT disclosure-policy checks for Zcash"
)]
struct Args {
    /// PCZT file path. Use "-" to read from standard input, never from an argument.
    file: PathBuf,
    /// Input encoding: raw binary PCZT or Zallet-compatible base64 transport.
    #[arg(long, value_enum, default_value = "binary")]
    input_format: InputFormat,
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
enum InputFormat {
    Binary,
    Base64,
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
    const MAX_PCZT_BYTES: usize = 8 * 1024 * 1024;
    // Read at most one byte beyond the hard input limit, including stdin.
    let max_encoded = MAX_PCZT_BYTES.div_ceil(3) * 4 + 256;
    let max_input = match args.input_format {
        InputFormat::Binary => MAX_PCZT_BYTES,
        InputFormat::Base64 => max_encoded,
    };
    let mut encoded_or_raw = Vec::new();
    if args.file.as_os_str() == "-" {
        io::stdin()
            .take((max_input + 1) as u64)
            .read_to_end(&mut encoded_or_raw)
            .map_err(|_| "Cannot read PCZT from standard input")?;
    } else {
        let info = fs::metadata(&args.file).map_err(|_| "Cannot read PCZT file")?;
        if !info.is_file() || info.len() > max_input as u64 {
            return Err("PCZT input is not a regular file or exceeds size limit");
        }
        encoded_or_raw = fs::read(&args.file).map_err(|_| "Cannot read PCZT file")?;
    }
    if encoded_or_raw.is_empty() || encoded_or_raw.len() > max_input {
        return Err("PCZT input is empty or exceeds size limit");
    }
    let bytes = match args.input_format {
        InputFormat::Binary => encoded_or_raw,
        InputFormat::Base64 => {
            // Raw base64 from pczt_create/prove/sign, optionally surrounded by
            // transport whitespace. Not a JSON RPC response or a wallet API.
            let trimmed = encoded_or_raw
                .split(|byte| byte.is_ascii_whitespace())
                .filter(|segment| !segment.is_empty())
                .flat_map(|segment| segment.iter().copied())
                .collect::<Vec<_>>();
            STANDARD
                .decode(trimmed)
                .map_err(|_| "Invalid base64 PCZT input")?
        }
    };
    if bytes.is_empty() || bytes.len() > MAX_PCZT_BYTES {
        return Err("Decoded PCZT is empty or exceeds 8 MiB");
    }
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
