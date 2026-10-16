#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
rustup target add wasm32-unknown-unknown
if ! command -v wasm-bindgen >/dev/null 2>&1; then
  echo "Install wasm-bindgen-cli 0.2.129 first: cargo install wasm-bindgen-cli --version 0.2.129 --locked" >&2
  exit 1
fi
cargo build --release --locked --target wasm32-unknown-unknown --features browser --lib
mkdir -p apps/web/public/wasm apps/web/src/wasm
wasm-bindgen --target web --out-dir apps/web/src/wasm --out-name zerynex target/wasm32-unknown-unknown/release/zerynex.wasm
cp apps/web/src/wasm/zerynex_bg.wasm apps/web/public/wasm/zerynex_bg.wasm
cargo run --locked --example generate_fixtures
echo "Zerynex Rust WASM and synthetic fixtures ready."
