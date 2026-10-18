"""Manager-neutral Python API delegating to the real local Rust executable."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
import os
import shutil
import subprocess
from typing import Literal

Profile = Literal["external_signer", "restricted_handoff"]
MAX_PCZT_BYTES = 8 * 1024 * 1024
MAX_REPORT_BYTES = 256 * 1024

class ZerynexError(Exception):
    """Safe, generic error. Never embeds input contents or CLI stderr."""

@dataclass(frozen=True)
class Policy:
    profile: Profile = "external_signer"
    deny_transparent: bool = False
    deny_sapling: bool = False

    def __post_init__(self) -> None:
        if self.profile not in ("external_signer", "restricted_handoff"):
            raise ZerynexError("Invalid privacy profile.")
        if type(self.deny_transparent) is not bool or type(self.deny_sapling) is not bool:
            raise ZerynexError("Policy restrictions must be boolean.")

    def as_dict(self) -> dict[str, str | bool]:
        return {
            "profile": self.profile,
            "deny_transparent": self.deny_transparent,
            "deny_sapling": self.deny_sapling,
        }

@dataclass(frozen=True)
class CliCapabilities:
    """Validated CLI feature metadata; does not imply upstream wallet compatibility."""
    version: str
    operations: tuple[str, ...]
    input_formats: tuple[str, ...]
    max_decoded_pczt_bytes: int
    max_policy_file_bytes: int
    output_formats: tuple[str, ...] = ("text", "json")
    rule_set_version: str | None = None


def _parse_cli_capabilities(raw: str) -> CliCapabilities:
    if len(raw) > 16 * 1024:
        raise ZerynexError("Local CLI capabilities report is too large.")
    try:
        data = json.loads(raw)
        if not isinstance(data, dict) or type(data.get("schema_version")) is not int or data["schema_version"] != 1:
            raise ValueError("schema")
        if data.get("tool") != "zerynex" or data.get("network_access") is not False or data.get("signing") is not False:
            raise ValueError("tool")
        version = data["cli_version"]
        operations = data["operations"]
        formats = data["input_formats"]
        if not isinstance(version, str) or not 0 < len(version) <= 64:
            raise ValueError("version")
        if (not isinstance(operations, list) or len(operations) > 10 or
                any(not isinstance(item, str) or item not in ("analyze_pczt", "compare_pczt_stages") for item in operations) or
                len(set(operations)) != len(operations) or "analyze_pczt" not in operations):
            raise ValueError("operations")
        if (not isinstance(formats, list) or len(formats) > 2 or
                any(item not in ("binary", "base64") for item in formats) or
                len(set(formats)) != len(formats) or "binary" not in formats):
            raise ValueError("formats")
        output_formats = data.get("output_formats", ["text", "json"])
        if (not isinstance(output_formats, list) or not 2 <= len(output_formats) <= 3 or
                any(not isinstance(item, str) or item not in ("text", "json", "sarif")
                    for item in output_formats) or
                len(set(output_formats)) != len(output_formats) or
                not {"text", "json"}.issubset(output_formats)):
            raise ValueError("unsupported output formats")
        rule_set_version = data.get("rule_set_version")
        if rule_set_version is not None and (not isinstance(rule_set_version,str) or
                not 0 < len(rule_set_version) <= 64):
            raise ValueError("rule set version")
        size = data["max_decoded_pczt_bytes"]
        policy_size = data["max_policy_file_bytes"]
        if type(size) is not int or not 0 < size <= MAX_PCZT_BYTES:
            raise ValueError("input limit")
        if type(policy_size) is not int or not 0 < policy_size <= 4096:
            raise ValueError("policy limit")
        return CliCapabilities(version, tuple(operations), tuple(formats), size, policy_size,
                               tuple(output_formats), rule_set_version)
    except (KeyError, ValueError, TypeError):
        raise ZerynexError("Invalid capabilities from local Rust CLI.") from None


@dataclass(frozen=True)
class Finding:
    rule: str
    field: str
    explanation: str

@dataclass(frozen=True)
class Report:
    profile: str
    deny_transparent: bool
    deny_sapling: bool
    checked_pools: tuple[str, ...]
    findings: tuple[Finding, ...]
    disclaimer: str

    @property
    def passed(self) -> bool:
        return not self.findings

    def agent_summary(self) -> dict[str, object]:
        """Only fixed classifications and field paths; no raw transaction data."""
        return {
            "passed": self.passed,
            "finding_count": len(self.findings),
            "profile": self.profile,
            "deny_transparent": self.deny_transparent,
            "deny_sapling": self.deny_sapling,
            "checked_pools": list(self.checked_pools),
            "findings": [
                {"rule": item.rule, "field": item.field, "explanation": item.explanation}
                for item in self.findings
            ],
            "limitation": "Limited policy checks; not a proof of anonymity, consensus validity, or safe signing.",
        }

def _parse_report(raw: str) -> Report:
    if len(raw) > MAX_REPORT_BYTES:
        raise ZerynexError("Rust report exceeds the configured output size.")
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        raise ZerynexError("Invalid response from local Rust analyzer.") from None
    if not isinstance(data, dict):
        raise ZerynexError("Invalid report structure.")
    try:
        profile = data["profile"]
        if profile not in ("external_signer", "restricted_handoff"):
            raise ValueError("profile")
        if type(data["deny_transparent"]) is not bool or type(data["deny_sapling"]) is not bool:
            raise ValueError("flags")
        pools = data["checked_pools"]
        if not isinstance(pools, list) or any(not isinstance(i, str) for i in pools):
            raise ValueError("pools")
        findings = data["findings"]
        if not isinstance(findings, list) or len(findings) > 1000:
            raise ValueError("findings")
        parsed = []
        for item in findings:
            if not isinstance(item, dict):
                raise ValueError("finding")
            rule, field, explanation = item["rule"], item["field"], item["explanation"]
            if any(not isinstance(v, str) or len(v) > 500 for v in (rule, field, explanation)):
                raise ValueError("finding field")
            parsed.append(Finding(rule, field, explanation))
        disclaimer = data["disclaimer"]
        if not isinstance(disclaimer, str):
            raise ValueError("disclaimer")
        return Report(
            profile=profile,
            deny_transparent=data["deny_transparent"],
            deny_sapling=data["deny_sapling"],
            checked_pools=tuple(pools),
            findings=tuple(parsed),
            disclaimer=disclaimer,
        )
    except (KeyError, TypeError, ValueError):
        raise ZerynexError("Invalid report structure.") from None

@dataclass(frozen=True)
class StageComparison:
    """Value-free classification of changes between two PCZT processing stages."""
    passed: bool
    no_new_findings: bool
    before_findings_count: int
    after_findings_count: int
    added_findings: tuple[tuple[str, str], ...]
    resolved_findings: tuple[tuple[str, str], ...]
    component_deltas: tuple[tuple[str, int, int], ...]
    disclaimer: str

    def agent_summary(self) -> dict[str, object]:
        return {
            "passed": self.passed,
            "no_new_findings": self.no_new_findings,
            "before_findings_count": self.before_findings_count,
            "after_findings_count": self.after_findings_count,
            "added_findings": [
                {"rule": rule, "field": field} for rule, field in self.added_findings
            ],
            "resolved_findings": [
                {"rule": rule, "field": field} for rule, field in self.resolved_findings
            ],
            "component_deltas": [
                {"component": name, "before": before, "after": after}
                for name, before, after in self.component_deltas
            ],
            "limitation": self.disclaimer,
        }


def _parse_stage_comparison(raw: str) -> StageComparison:
    if len(raw) > MAX_REPORT_BYTES:
        raise ZerynexError("Stage report exceeds output limit.")
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("format")
        passed = data["passed"]
        no_new = data["no_new_findings"]
        counts = (data["before_findings_count"], data["after_findings_count"])
        if type(passed) is not bool or type(no_new) is not bool:
            raise ValueError("status")
        if any(type(c) is not int or not 0 <= c <= 1000 for c in counts):
            raise ValueError("counts")
        parsed = []
        for key in ("added_findings", "resolved_findings"):
            entries = data[key]
            if not isinstance(entries, list) or len(entries) > 1000:
                raise ValueError(key)
            values = []
            for entry in entries:
                if not isinstance(entry, dict):
                    raise ValueError(key)
                rule, field = entry["rule"], entry["field"]
                if any(not isinstance(value, str) or not 0 < len(value) <= 500
                       for value in (rule, field)):
                    raise ValueError(key)
                values.append((rule, field))
            parsed.append(tuple(values))
        changes = []
        deltas = data["component_deltas"]
        if not isinstance(deltas, list) or len(deltas) > 6:
            raise ValueError("components")
        for item in deltas:
            component, before, after = item["component"], item["before"], item["after"]
            if component not in (
                "transparent.inputs", "transparent.outputs", "sapling.spends",
                "sapling.outputs", "orchard.actions", "ironwood.actions"
            ) or any(type(c) is not int or not 0 <= c <= 1000000 for c in (before, after)):
                raise ValueError("components")
            changes.append((component, before, after))
        if passed != (not parsed[0] and not changes and counts[1] == 0):
            raise ValueError("status mismatch")
        disclaimer = data["disclaimer"]
        if not isinstance(disclaimer, str) or not disclaimer:
            raise ValueError("disclaimer")
        return StageComparison(
            passed, no_new, counts[0], counts[1], parsed[0], parsed[1],
            tuple(changes), disclaimer,
        )
    except (KeyError, TypeError, ValueError):
        raise ZerynexError("Invalid stage comparison report.") from None


class ZerynexClient:
    """Invoke trusted Rust CLI locally; never run a shell or log PCZT content."""

    def __init__(self, cli: str | Path | None = None, timeout: float = 12.0):
        if not (0 < timeout <= 120):
            raise ZerynexError("Timeout must be between 0 and 120 seconds.")
        chosen = cli or os.environ.get("ZERYNEX_CLI") or shutil.which("zerynex")
        if not chosen:
            raise ZerynexError("Zerynex CLI was not found; install/build the Rust executable.")
        executable = Path(chosen).expanduser().resolve(strict=False)
        if not executable.is_file():
            raise ZerynexError("Configured Rust CLI does not exist.")
        self._cli = executable
        self._timeout = timeout

    def rule_catalog(self) -> dict[str, object]:
        """Read bounded, validated public metadata from the actual local Rust CLI.

        No PCZT, policy or wallet path is provided to the subprocess.
        """
        from .rules import parse_rule_catalog
        try:
            completed = subprocess.run(
                [str(self._cli), "--rule-catalog"], shell=False,
                stdin=subprocess.DEVNULL, capture_output=True, text=True,
                timeout=self._timeout, check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            raise ZerynexError("Local rule catalog discovery failed or timed out.") from None
        if completed.returncode != 0:
            raise ZerynexError("Local CLI does not support rule catalog discovery.")
        return parse_rule_catalog(completed.stdout)

    def capabilities(self) -> CliCapabilities:
        """Inspect supported local Rust CLI operations without passing PCZT data."""
        try:
            result = subprocess.run(
                [str(self._cli), "--capabilities"], shell=False,
                stdin=subprocess.DEVNULL, capture_output=True, text=True,
                timeout=self._timeout, check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            raise ZerynexError("Local Rust CLI capabilities check failed or timed out.") from None
        if result.returncode != 0:
            raise ZerynexError("Local CLI does not support capabilities negotiation.")
        return _parse_cli_capabilities(result.stdout)

    def analyze_file(self, path: str | Path, policy: Policy | None = None) -> Report:
        config = policy if policy is not None else Policy()
        if not isinstance(config, Policy):
            raise ZerynexError("A Policy object is required.")
        try:
            candidate = Path(path).expanduser().resolve(strict=True)
            if not candidate.is_file() or not (0 < candidate.stat().st_size <= MAX_PCZT_BYTES):
                raise ZerynexError("PCZT file must be nonempty and at most 8 MiB.")
        except (OSError, ValueError, TypeError):
            raise ZerynexError("Cannot read the selected PCZT file.") from None

        return self._run([str(candidate)], config)

    def compare_files(
        self,
        baseline: str | Path,
        candidate: str | Path,
        policy: Policy | None = None,
    ) -> StageComparison:
        """Compare selected policy findings and pool counts, locally.

        Not a signature, commitment, amount, recipient or proof equivalence check.
        """
        config = policy if policy is not None else Policy()
        if not isinstance(config, Policy):
            raise ZerynexError("A Policy object is required.")
        sources = []
        for value in (baseline, candidate):
            try:
                path = Path(value).expanduser().resolve(strict=True)
                if not path.is_file() or not 0 < path.stat().st_size <= MAX_PCZT_BYTES:
                    raise ZerynexError("PCZT must be a nonempty regular file no larger than 8 MiB.")
                sources.append(str(path))
            except (OSError, ValueError, TypeError):
                raise ZerynexError("Cannot read a selected PCZT stage file.") from None
        args = [str(self._cli), sources[0], "--compare-with", sources[1], "--json",
                "--profile", config.profile.replace("_", "-")]
        if config.deny_transparent:
            args.append("--deny-transparent")
        if config.deny_sapling:
            args.append("--deny-sapling")
        try:
            result = subprocess.run(args, shell=False, stdin=subprocess.DEVNULL,
                                    capture_output=True, text=True, timeout=self._timeout)
        except (OSError, subprocess.TimeoutExpired):
            raise ZerynexError("Local Rust stage comparison failed or timed out.") from None
        if result.returncode not in (0, 2):
            raise ZerynexError("PCZT stages could not be compared.") from None
        report = _parse_stage_comparison(result.stdout)
        if (result.returncode == 0) != report.passed:
            raise ZerynexError("Rust stage result and exit code disagree.")
        return report

    def analyze_base64(self, base64_pczt: str, policy: Policy | None = None) -> Report:
        """Analyze a local Zallet-style base64 PCZT in memory via Rust stdin.

        No temporary transaction file, stdout of raw bytes, RPC call, or shell.
        Keep this data in a trusted local process, never an agent prompt.
        """
        config = policy if policy is not None else Policy()
        if not isinstance(config, Policy):
            raise ZerynexError("A Policy object is required.")
        if (not isinstance(base64_pczt, str) or
                not 0 < len(base64_pczt) <= (MAX_PCZT_BYTES + 2) // 3 * 4 + 256 or
                not base64_pczt.isascii()):
            raise ZerynexError("Encoded PCZT is missing or exceeds the input limit.")
        return self._run(["-", "--input-format", "base64"], config, base64_pczt)

    def _run(self, input_args: list[str], config: Policy, stdin_text: str | None = None) -> Report:
        args = [
            str(self._cli), *input_args, "--profile", config.profile.replace("_", "-"), "--json",
        ]
        if config.deny_transparent:
            args.append("--deny-transparent")
        if config.deny_sapling:
            args.append("--deny-sapling")
        try:
            completed = subprocess.run(
                args,
                shell=False,
                stdin=subprocess.DEVNULL if stdin_text is None else None,
                input=stdin_text,
                capture_output=True,
                text=True,
                timeout=self._timeout,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            raise ZerynexError("Local Rust analyzer failed or timed out.") from None
        if completed.returncode not in (0, 2):
            # Never echo PCZT bytes, stderr or CLI diagnostics.
            raise ZerynexError("PCZT could not be analyzed.")
        report = _parse_report(completed.stdout)
        if report.profile != config.profile or (
            report.deny_transparent != config.deny_transparent
            or report.deny_sapling != config.deny_sapling
        ):
            raise ZerynexError("Local analyzer returned an unexpected policy configuration.")
        if (completed.returncode == 0) != report.passed:
            raise ZerynexError("Local analyzer returned inconsistent findings.")
        return report
