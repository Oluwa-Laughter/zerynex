from .rules import bundled_rule_catalog
"""Local Python adapter for the shared Zerynex Rust PCZT privacy engine.

Use with a trusted Zerynex CLI executable. This package contains NO alternate
Zcash parser, remote upload service, signing functionality or LLM dependency.
"""
from .z3 import ZebraHealthReport, check_zebra_local
from .client import (
    CliCapabilities,
    Finding,
    Policy,
    Report,
    StageComparison,
    ZerynexClient,
    ZerynexError,
)

__all__ = ["bundled_rule_catalog", "CliCapabilities", "Finding", "Policy", "Report", "StageComparison", "ZerynexClient", "ZerynexError", "ZebraHealthReport", "check_zebra_local"]
__version__ = "0.1.0"
