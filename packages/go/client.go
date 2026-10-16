// Package zerynex delegates local PCZT policy checks to the canonical Rust CLI.
//
// This SDK does not implement Zcash cryptography and never transmits PCZT bytes
// to a hosted Zerynex service. It is not a remote RPC wallet client.
package zerynex

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const maxPCZT = 8 * 1024 * 1024
const maxOutput = 256 * 1024

// ErrAnalysis deliberately hides CLI diagnostics and input contents.
var ErrAnalysis = errors.New("zerynex: local PCZT analysis failed")
var ErrInput = errors.New("zerynex: invalid PCZT input or policy")

// Policy controls only the disclosure checks implemented by Rust.
type Policy struct {
	Profile         string
	DenyTransparent bool
	DenySapling     bool
}

func (p Policy) arguments() ([]string, error) {
	profile := p.Profile
	if profile == "" {
		profile = "external_signer"
	}
	if profile != "external_signer" && profile != "restricted_handoff" {
		return nil, ErrInput
	}
	args := []string{"--profile", strings.ReplaceAll(profile, "_", "-"), "--json"}
	if p.DenyTransparent {
		args = append(args, "--deny-transparent")
	}
	if p.DenySapling {
		args = append(args, "--deny-sapling")
	}
	return args, nil
}

type Finding struct {
	Rule        string `json:"rule"`
	Field       string `json:"field"`
	Explanation string `json:"explanation"`
}
type Report struct {
	Profile         string    `json:"profile"`
	DenyTransparent bool      `json:"deny_transparent"`
	DenySapling     bool      `json:"deny_sapling"`
	CheckedPools    []string  `json:"checked_pools"`
	Findings        []Finding `json:"findings"`
	Disclaimer      string    `json:"disclaimer"`
}

func (r Report) Passed() bool { return len(r.Findings) == 0 }

type StageFinding struct {
	Rule  string `json:"rule"`
	Field string `json:"field"`
}
type ComponentDelta struct {
	Component string `json:"component"`
	Before    int    `json:"before"`
	After     int    `json:"after"`
}
type StageComparison struct {
	Profile             string           `json:"profile"`
	DenyTransparent     bool             `json:"deny_transparent"`
	DenySapling         bool             `json:"deny_sapling"`
	BeforeFindingsCount int              `json:"before_findings_count"`
	AfterFindingsCount  int              `json:"after_findings_count"`
	AddedFindings       []StageFinding   `json:"added_findings"`
	ResolvedFindings    []StageFinding   `json:"resolved_findings"`
	ComponentDeltas     []ComponentDelta `json:"component_deltas"`
	NoNewFindings       bool             `json:"no_new_findings"`
	Passed              bool             `json:"passed"`
	Disclaimer          string           `json:"disclaimer"`
}

// Client requires an explicitly configured, trusted local zerynex binary.
type Client struct {
	Binary  string
	Timeout time.Duration
}

func (c Client) command(ctx context.Context, args []string, stdin io.Reader) ([]byte, int, error) {
	if c.Binary == "" {
		return nil, 0, ErrInput
	}
	if c.Timeout < 0 {
		return nil, 0, ErrInput
	}
	timeout := c.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	cmd := exec.CommandContext(runCtx, c.Binary, args...)
	if stdin != nil {
		cmd.Stdin = stdin
	}
	var output bytes.Buffer
	cmd.Stdout = &limitedWriter{buffer: &output, remaining: maxOutput}
	cmd.Stderr = io.Discard
	err := cmd.Run()
	if runCtx.Err() != nil {
		return nil, 0, ErrAnalysis
	}
	if err != nil {
		var failure *exec.ExitError
		if !errors.As(err, &failure) || failure.ExitCode() != 2 {
			return nil, 0, ErrAnalysis
		}
		return output.Bytes(), 2, nil
	}
	return output.Bytes(), 0, nil
}

type limitedWriter struct {
	buffer    *bytes.Buffer
	remaining int
}

func (writer *limitedWriter) Write(b []byte) (int, error) {
	if len(b) > writer.remaining {
		return 0, ErrAnalysis
	}
	written, err := writer.buffer.Write(b)
	writer.remaining -= written
	return written, err
}
func safeFile(filename string, maxBytes int64) (string, error) {
	if filename == "" || filename == "-" {
		return "", ErrInput
	}
	absolute, err := filepath.Abs(filename)
	if err != nil {
		return "", ErrInput
	}
	stat, err := os.Stat(absolute)
	if err != nil || !stat.Mode().IsRegular() || stat.Size() <= 0 || stat.Size() > maxBytes {
		return "", ErrInput
	}
	return absolute, nil
}
func decodeSafe(raw []byte, into any) error {
	reader := bytes.NewReader(raw)
	decoder := json.NewDecoder(reader)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(into); err != nil {
		return ErrAnalysis
	}
	var remainder any
	if decoder.Decode(&remainder) != io.EOF {
		return ErrAnalysis
	}
	return nil
}
func validateReport(r Report, p Policy, status int) error {
	expected := p.Profile
	if expected == "" {
		expected = "external_signer"
	}
	if r.Profile != expected || r.DenyTransparent != p.DenyTransparent ||
		r.DenySapling != p.DenySapling || len(r.CheckedPools) != 4 ||
		r.Disclaimer == "" || (status == 0) != r.Passed() || len(r.Findings) > 1000 {
		return ErrAnalysis
	}
	for _, item := range r.Findings {
		if item.Rule == "" || item.Field == "" || item.Explanation == "" ||
			len(item.Rule) > 500 || len(item.Field) > 500 || len(item.Explanation) > 500 {
			return ErrAnalysis
		}
	}
	return nil
}

// AnalyzeFile checks a locally held raw binary PCZT.
func (c Client) AnalyzeFile(ctx context.Context, filename string, policy Policy) (Report, error) {
	var empty Report
	file, err := safeFile(filename, maxPCZT)
	if err != nil {
		return empty, err
	}
	flags, err := policy.arguments()
	if err != nil {
		return empty, err
	}
	args := append([]string{file}, flags...)
	raw, code, err := c.command(ctx, args, nil)
	if err != nil {
		return empty, err
	}
	var report Report
	if decodeSafe(raw, &report) != nil || validateReport(report, policy, code) != nil {
		return empty, ErrAnalysis
	}
	return report, nil
}

// AnalyzeBase64 sends an already-held Zallet-style base64 PCZT through Rust
// stdin. Do not pass private bytes to public CI, logs or AI agents.
func (c Client) AnalyzeBase64(ctx context.Context, encoded string, policy Policy) (Report, error) {
	var empty Report
	if len(encoded) == 0 || len(encoded) > (maxPCZT+2)/3*4+256 {
		return empty, ErrInput
	}
	flags, err := policy.arguments()
	if err != nil {
		return empty, err
	}
	args := append([]string{"-", "--input-format", "base64"}, flags...)
	raw, code, err := c.command(ctx, args, strings.NewReader(encoded))
	if err != nil {
		return empty, err
	}
	var report Report
	if decodeSafe(raw, &report) != nil || validateReport(report, policy, code) != nil {
		return empty, ErrAnalysis
	}
	return report, nil
}

// CompareFiles checks two local PCZT stages for changes in rule presence and
// component counts. It does NOT prove cryptographic equivalence.
func (c Client) CompareFiles(ctx context.Context, baseline, candidate string, policy Policy) (StageComparison, error) {
	var empty StageComparison
	first, err := safeFile(baseline, maxPCZT)
	if err != nil {
		return empty, err
	}
	second, err := safeFile(candidate, maxPCZT)
	if err != nil {
		return empty, err
	}
	flags, err := policy.arguments()
	if err != nil {
		return empty, err
	}
	args := append([]string{first, "--compare-with", second}, flags...)
	raw, code, err := c.command(ctx, args, nil)
	if err != nil {
		return empty, err
	}
	var report StageComparison
	if decodeSafe(raw, &report) != nil || report.Disclaimer == "" ||
		len(report.AddedFindings) > 1000 || len(report.ComponentDeltas) > 6 ||
		report.BeforeFindingsCount < 0 || report.AfterFindingsCount < 0 ||
		report.Passed != (code == 0) {
		return empty, ErrAnalysis
	}
	return report, nil
}
