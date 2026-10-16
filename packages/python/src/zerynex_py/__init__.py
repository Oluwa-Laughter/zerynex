"""Local Python adapter for the shared Zerynex Rust PCZT privacy engine.

Use with a trusted Zerynex CLI executable. This package contains NO alternate
Zcash parser, remote upload service, signing functionality or LLM dependency.
"""
from .client import (
    Finding,
    Policy,
    Report,
    ZerynexClient,
    ZerynexError,
)

__all__ = ["Finding", "Policy", "Report", "ZerynexClient", "ZerynexError"]
__version__ = "0.1.0"
