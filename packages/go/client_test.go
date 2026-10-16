package zerynex

import (
	"context"
	"encoding/base64"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPolicyRejectsInvalidProfiles(t *testing.T) {
	_, err := (Policy{Profile: "../../unsafe"}).arguments()
	if !errors.Is(err, ErrInput) {
		t.Fatal("unexpected policy accepted")
	}
}

func TestCannotAnalyzeMissingFileOrBinary(t *testing.T) {
	client := Client{Binary: "/missing/zerynex"}
	_, err := client.AnalyzeFile(context.Background(), "does-not-exist.pczt", Policy{})
	if !errors.Is(err, ErrInput) {
		t.Fatal("missing input accepted")
	}
	_, err = client.AnalyzeBase64(context.Background(), strings.Repeat("!", maxPCZT*2), Policy{})
	if !errors.Is(err, ErrInput) {
		t.Fatal("oversized base64 input accepted")
	}
}

func integration(t *testing.T) (Client, string) {
	t.Helper()
	binary := os.Getenv("ZERYNEX_TEST_CLI")
	root := os.Getenv("ZERYNEX_TEST_FIXTURES")
	if binary == "" || root == "" {
		t.Skip("Use compiled Rust CLI and fixtures in integration CI")
	}
	return Client{Binary: binary}, root
}

func TestRealRustCliAgainstCleanAndTransparentFixtures(t *testing.T) {
	client, root := integration(t)
	clean, err := client.AnalyzeFile(context.Background(), filepath.Join(root, "clean-v6.bin"), Policy{})
	if err != nil {
		t.Fatal(err)
	}
	if !clean.Passed() {
		t.Fatal("synthetic clean PCZT was rejected")
	}
	flagged, err := client.AnalyzeFile(context.Background(), filepath.Join(root, "transparent-v6.bin"), Policy{DenyTransparent: true})
	if err != nil {
		t.Fatal(err)
	}
	if flagged.Passed() || len(flagged.Findings) != 1 || flagged.Findings[0].Rule != "PCZT-TRANSPARENT-OUTPUTS" {
		t.Fatal("transparent-output policy regression")
	}
}

func TestRealRustCliBase64Stdin(t *testing.T) {
	client, root := integration(t)
	raw, err := os.ReadFile(filepath.Join(root, "transparent-v6.bin"))
	if err != nil {
		t.Fatal(err)
	}
	encoded := base64.StdEncoding.EncodeToString(raw)
	report, err := client.AnalyzeBase64(context.Background(), encoded, Policy{DenyTransparent: true})
	if err != nil || report.Passed() {
		t.Fatal("real base64 input did not produce policy finding", err)
	}
	_, err = client.AnalyzeBase64(context.Background(), "PRIVATE_TEST_VALUE!", Policy{})
	if err == nil || strings.Contains(err.Error(), "PRIVATE_TEST_VALUE") {
		t.Fatal("raw bytes leaked or invalid base64 accepted")
	}
}

func TestStageRegressionUsesCanonicalRustEngine(t *testing.T) {
	client, root := integration(t)
	report, err := client.CompareFiles(
		context.Background(),
		filepath.Join(root, "clean-v6.bin"),
		filepath.Join(root, "flagged-v6.bin"),
		Policy{},
	)
	if err != nil {
		t.Fatal(err)
	}
	if report.Passed || len(report.AddedFindings) != 1 ||
		report.AddedFindings[0].Rule != "PCZT-GLOBAL-METADATA" {
		t.Fatal("missing new disclosure", report)
	}
}
