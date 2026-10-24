# Go SDK for Zcash developer tools

**Status: public module v0.2.0.** Install the [versioned Go adapter](https://pkg.go.dev/github.com/Oluwa-Laughter/zerynex/packages/go)
from the official module proxy. It calls the separately installed canonical
Rust CLI and does not reimplement Zcash cryptography.

## Why a Go integration?

Go is common in backend infrastructure and developer services. Go engineers
should be able to run local PCZT policy checks and transaction-stage
regressions without writing a Rust or JavaScript application.

## Install the Rust engine

    cargo install --git https://github.com/Oluwa-Laughter/zerynex --locked --bin zerynex

Then add the reviewed Go module to your own application's `go.mod`:

```bash
go get github.com/Oluwa-Laughter/zerynex/packages/go@v0.2.0
```

The release is tagged `packages/go/v0.2.0` in the monorepo and is independently
retrievable through the Go module proxy. Build from pinned source if you need
to reproduce the adapter. Installing the Go module does **not** install the Rust CLI.

## Example

In a Go module with the version-pinned dependency installed, use:

    import (
        "context"
        zerynex "github.com/Oluwa-Laughter/zerynex/packages/go"
    )

    client := zerynex.Client{Binary: "/absolute/path/to/zerynex"}
    report, err := client.AnalyzeFile(
        context.Background(),
        "/path/to/local-synthetic.pczt",
        zerynex.Policy{DenyTransparent:true},
    )
    if err != nil {
        // Treat it as an input or analyzer error, not as a passing report.
    }
    if !report.Passed() {
        // Review rule IDs and field paths, never raw transaction bytes.
    }

## Supported adapter methods

- AnalyzeFile: local binary PCZT and selected Rust privacy policy.
- AnalyzeBase64: in-memory Zallet-compatible base64 PCZT sent through stdin.
- CompareFiles: rule-presence and component-count stage regression summary.

The adapter uses context timeouts, safe error messages and explicit binary
paths. No credentials, RPC endpoints or external network requests are used.

## Testing and limitations

The Go package's tests are run in GitHub CI against the actual compiled
Rust executable and checked-in synthetic fixtures. The Rust CLI still
provides the protocol logic and determines the supported PCZT version/rules.

This does not implement proof generation, sign transactions or prove
cryptographic equivalence. Do not store real user transactions in CI.
