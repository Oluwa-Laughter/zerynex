//! Minimal ZIP-321 stdin-only inspector: redacted reports only.
use clap::Parser;
use std::io::{self, Read};
use zerynex::payments::{parse_zip321, PaymentNetwork};

#[derive(Parser)]
#[command(
    name = "zerynex-payreq",
    version,
    about = "Offline ZIP-321 ZEC payment request inspector (redacted; no wallet access)"
)]
struct Args {
    /// Explicit Zcash network of payment addresses.
    #[arg(long, value_parser=["main","test","regtest"])]
    network: String,
    /// Emit a sanitized JSON summary without addresses, labels, messages or memos.
    #[arg(long, default_value_t = true)]
    json: bool,
}
fn run() -> Result<(), &'static str> {
    let args = Args::parse();
    let mut bytes = Vec::new();
    io::stdin()
        .take(16 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Cannot read payment request")?;
    if bytes.is_empty() || bytes.len() > 16 * 1024 {
        return Err("Payment request exceeds size limit");
    }
    let request = std::str::from_utf8(&bytes).map_err(|_| "Invalid UTF-8 payment request")?;
    let request = request.trim_end_matches(['\r', '\n']);
    let parsed = parse_zip321(request, PaymentNetwork::parse(&args.network)?)?;
    let output =
        serde_json::to_string(&parsed.summary()).map_err(|_| "Cannot encode payment report")?;
    println!("{output}");
    Ok(())
}
fn main() {
    if run().is_err() {
        eprintln!("Invalid or unsupported ZIP-321 request; review the local input and network.");
        std::process::exit(1)
    }
}
