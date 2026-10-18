mod sarif;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use clap::{Parser, ValueEnum};
use std::{
    fs,
    io::{self, Read},
    path::PathBuf,
    process::ExitCode,
};
use zerynex::{
    analyze_with_policy, compare_stages_with_policy, parse_policy_json, PolicyConfig, Profile,
};

#[derive(Parser)]
#[command(
    name = "zerynex",
    version,
    about = "Local PCZT disclosure-policy checks for Zcash"
)]
struct Args {
    /// PCZT file path. Use "-" to read from standard input, never from an argument.
    #[arg(required_unless_present = "capabilities")]
    file: Option<PathBuf>,
    /// Print versioned JSON CLI capabilities without reading any files.
    #[arg(long, exclusive = true)]
    capabilities: bool,
    /// Input encoding: raw binary PCZT or Zallet-compatible base64 transport.
    #[arg(long, value_enum, default_value = "binary")]
    input_format: InputFormat,
    /// Optional candidate PCZT. Compare two stages, reporting only privacy-field
    /// and component count differences. Both inputs use --input-format.
    #[arg(long)]
    compare_with: Option<PathBuf>,
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
    #[arg(long, conflicts_with = "sarif")]
    json: bool,
    /// Emit redacted SARIF 2.1.0 for developer security tooling; no PCZT filenames or transaction bytes.
    #[arg(long, conflicts_with = "json")]
    sarif: bool,
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
        let contents = read_limited_file(path, 4096, "Cannot read policy file")?;
        let contents = std::str::from_utf8(&contents).map_err(|_| "Invalid UTF-8 policy")?;
        parse_policy_json(contents)?
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
// Use bounded reads for disk files too: metadata checks followed by fs::read
// can otherwise allocate an arbitrarily large file after a concurrent change.
fn read_limited_file(
    path: &PathBuf,
    limit: usize,
    error: &'static str,
) -> Result<Vec<u8>, &'static str> {
    let handle = fs::File::open(path).map_err(|_| error)?;
    let metadata = handle.metadata().map_err(|_| error)?;
    if !metadata.is_file() || metadata.len() > limit as u64 {
        return Err(error);
    }
    let mut bytes = Vec::new();
    handle
        .take((limit + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|_| error)?;
    if bytes.len() > limit {
        return Err(error);
    }
    Ok(bytes)
}

const MAX_PCZT_BYTES: usize = 8 * 1024 * 1024;

fn read_pczt(file: &PathBuf, input_format: InputFormat) -> Result<Vec<u8>, &'static str> {
    // Read at most one byte beyond the hard input limit, including stdin.
    let max_encoded = MAX_PCZT_BYTES.div_ceil(3) * 4 + 256;
    let max_input = match input_format {
        InputFormat::Binary => MAX_PCZT_BYTES,
        InputFormat::Base64 => max_encoded,
    };
    let mut encoded_or_raw = Vec::new();
    if file.as_os_str() == "-" {
        io::stdin()
            .take((max_input + 1) as u64)
            .read_to_end(&mut encoded_or_raw)
            .map_err(|_| "Cannot read PCZT from standard input")?;
    } else {
        encoded_or_raw = read_limited_file(
            file,
            max_input,
            "PCZT input is not a regular file or exceeds size limit",
        )?;
    }
    if encoded_or_raw.is_empty() || encoded_or_raw.len() > max_input {
        return Err("PCZT input is empty or exceeds size limit");
    }
    let bytes = match input_format {
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
    Ok(bytes)
}

fn run() -> Result<ExitCode, &'static str> {
    let args = Args::parse();
    if args.capabilities {
        // Public, static metadata only: safe for SDKs to query without
        // providing a wallet file or passing private data on the command line.
        let capabilities = serde_json::json!({
            "schema_version": 1,
            "cli_version": env!("CARGO_PKG_VERSION"),
            "tool": "zerynex",
            "operations": ["analyze_pczt", "compare_pczt_stages"],
            "input_formats": ["binary", "base64"],
            "output_formats": ["text", "json", "sarif"],
            "input_sources": ["file", "stdin"],
            "policy_profiles": ["external_signer", "restricted_handoff"],
            "max_decoded_pczt_bytes": MAX_PCZT_BYTES,
            "max_policy_file_bytes": 4096,
            "exit_codes": {"pass": 0, "error": 1, "findings_or_regressions": 2},
            "network_access": false,
            "signing": false,
            "disclaimer": "Selected local PCZT disclosure-policy checks only; not wallet compatibility, proof validity, signing safety, or anonymity verification."
        });
        println!("{}", capabilities);
        return Ok(ExitCode::SUCCESS);
    }
    let file = args.file.as_ref().ok_or("PCZT input path required")?;
    let policy = load_policy(&args)?;
    let bytes = read_pczt(file, args.input_format)?;
    if let Some(candidate_path) = &args.compare_with {
        if candidate_path.as_os_str() == "-" {
            return Err("Cannot compare two standard-input streams; supply a candidate file");
        }
        let candidate = read_pczt(candidate_path, args.input_format)?;
        let result = compare_stages_with_policy(&bytes, &candidate, policy)?;
        if args.sarif {
            let after = analyze_with_policy(&candidate, policy)?;
            println!("{}", sarif::comparison(&after, &result)?);
        } else if args.json {
            println!(
                "{}",
                serde_json::to_string_pretty(&result).map_err(|_| "Cannot encode comparison")?
            );
        } else {
            println!(
                "Zerynex stages: {} added findings, {} resolved, {} component changes; passed: {}",
                result.added_findings.len(),
                result.resolved_findings.len(),
                result.component_deltas.len(),
                result.passed
            );
            for f in &result.added_findings {
                println!("NEW {} at {}", f.rule, f.field);
            }
            for change in &result.component_deltas {
                println!(
                    "CHANGED {} count: {} -> {}",
                    change.component, change.before, change.after
                );
            }
        }
        return Ok(if result.passed {
            ExitCode::SUCCESS
        } else {
            ExitCode::from(2)
        });
    }
    let report = analyze_with_policy(&bytes, policy)?;
    if args.sarif {
        println!("{}", sarif::analysis(&report)?);
    } else if args.json {
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
