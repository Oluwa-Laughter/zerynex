# Zerynex Go SDK (source integration)

This package allows Go services and wallet/infrastructure tools to call the
**same canonical Rust Zerynex CLI** through the standard-library os/exec
interface. There is no wallet access, Go cryptographic fork, hosted API,
shell interpretation or dependency on the Next.js website.

## Build Rust first

    cargo build --locked --release --bin zerynex

## Add the Go package to an application

This Go module lives at github.com/Oluwa-Laughter/zerynex/packages/go.
Until tags and external module availability are verified for a release,
prefer a pinned version/commit and workspaces or vendoring for development.

    import (
      "context"
      "github.com/Oluwa-Laughter/zerynex/packages/go"
    )

    client := zerynex.Client{Binary:"/absolute/path/to/zerynex"}
    report, err := client.AnalyzeFile(
      context.Background(),
      "/path/to/approved-local-fixture.pczt",
      zerynex.Policy{DenyTransparent:true},
    )

If report.Passed() returns false, check the sanitized rule identifiers and
field paths. Errors never expose PCZT or CLI stderr.

The API also offers AnalyzeBase64 for Zallet-style encoded PCZT transport
through stdin, and CompareFiles for stage-regression observations. Neither
operation makes RPC/network calls.

## Test the Go package against actual Rust

    cd packages/go
    ZERYNEX_TEST_CLI=/absolute/path/to/target/debug/zerynex \
    ZERYNEX_TEST_FIXTURES=/absolute/path/to/apps/web/public/examples \
    go test -race ./...

The repository GitHub CI runs the Go compiler, tests, and this real Rust
integration (including transparent-output and base64 checks).

## Limitations

Source SDK, not a stable released distribution. Rust binary required.
It does not verify proofs, signatures, consensus, wallet privacy or
transaction equivalence. Do not upload actual wallet PCZT data to CI.
