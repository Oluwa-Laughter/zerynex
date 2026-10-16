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
