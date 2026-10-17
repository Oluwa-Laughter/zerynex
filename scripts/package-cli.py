#!/usr/bin/env python3
"""Create OS-native, source-free Zerynex CLI release archives.

Only known executables, license and public documentation/policies are included.
No PCZT fixtures, wallet intermediates, secrets or project source are shipped.
"""
from __future__ import annotations

import argparse
import hashlib
import io
from pathlib import Path
import platform
import sys
import tarfile
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = tomllib.loads((ROOT / "Cargo.toml").read_text())["package"]["version"]


def platform_label() -> tuple[str, str, str]:
    system = {"linux": "linux", "darwin": "macos", "win32": "windows"}.get(sys.platform)
    if system is None:
        raise SystemExit("Unsupported release platform.")
    machine = platform.machine().lower()
    arch = {"amd64": "x86_64", "x86_64": "x86_64", "arm64": "aarch64",
            "aarch64": "aarch64"}.get(machine)
    if arch is None:
        raise SystemExit("Unsupported release architecture.")
    return system, arch, ".exe" if system == "windows" else ""


def package(out: Path, binaries: Path) -> Path:
    system, arch, suffix = platform_label()
    folder = f"zerynex-v{VERSION}-{system}-{arch}"
    docs = [ROOT / "LICENSE", ROOT / "docs" / "installation.md", ROOT / "docs" / "agents.md"]
    policies = sorted((ROOT / "policies").glob("*.json"))
    files: list[tuple[str, bytes, int]] = []
    for name in ("zerynex", "zerynex-handoff"):
        path = binaries / (name + suffix)
        if not path.is_file() or path.stat().st_size < 1000:
            raise SystemExit(f"Missing compiled release executable: {name}")
        files.append((f"{folder}/{name}{suffix}", path.read_bytes(), 0o755))
    for path in [*docs, *policies]:
        if not path.is_file():
            raise SystemExit("Missing release documentation.")
        location = path.relative_to(ROOT)
        files.append((f"{folder}/{location.as_posix()}", path.read_bytes(), 0o644))
    out.mkdir(parents=True, exist_ok=True)
    if system == "windows":
        archive = out / (folder + ".zip")
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as target:
            for name, contents, perm in files:
                info = zipfile.ZipInfo(name)
                info.external_attr = ((0o100000 | perm) << 16)
                info.compress_type = zipfile.ZIP_DEFLATED
                target.writestr(info, contents)
    else:
        archive = out / (folder + ".tar.gz")
        with tarfile.open(archive, "w:gz") as target:
            for name, contents, perm in files:
                info = tarfile.TarInfo(name)
                info.size = len(contents)
                info.mode = perm
                target.addfile(info, io.BytesIO(contents))
    (out / f"SHA256SUMS-{system}-{arch}.txt").write_text(
        f"{hashlib.sha256(archive.read_bytes()).hexdigest()}  {archive.name}\n"
    )
    print(f"CLI release archive: {archive.name}, {archive.stat().st_size} bytes")
    return archive


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=ROOT / "dist" / "releases")
    parser.add_argument("--binaries", type=Path, default=ROOT / "target" / "release")
    options = parser.parse_args()
    package(options.out, options.binaries)


if __name__ == "__main__":
    main()
