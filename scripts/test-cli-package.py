#!/usr/bin/env python3
"""Test downloaded-style compiled CLI artifacts outside the monorepo."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def verify(archive: Path) -> None:
    if archive.is_dir():
        files = list(archive.glob("zerynex-v*.tar.gz")) + list(archive.glob("zerynex-v*.zip"))
        if len(files) != 1:
            raise AssertionError("Expected exactly one OS-specific CLI distribution archive.")
        archive = files[0]
    parts = archive.name.split("-")
    digest_name = f"SHA256SUMS-{parts[-2]}-{parts[-1].split('.')[0]}.txt"
    is_windows = archive.suffix == ".zip"
    executable = "zerynex.exe" if is_windows else "zerynex"
    expected_checksum = (archive.parent / digest_name).read_text().strip().split()
    assert len(expected_checksum) == 2
    assert expected_checksum[1] == archive.name
    assert expected_checksum[0] == hashlib.sha256(archive.read_bytes()).hexdigest()
    with tempfile.TemporaryDirectory(prefix="zerynex-cli-consumer-") as td:
        root = Path(td)
        if is_windows:
            with zipfile.ZipFile(archive) as contents:
                matches = [name for name in contents.namelist() if name.endswith("/" + executable)]
                assert len(matches) == 1
                binary = contents.read(matches[0])
        else:
            with tarfile.open(archive) as contents:
                matches = [member for member in contents if member.name.endswith("/" + executable)]
                assert len(matches) == 1
                binary = contents.extractfile(matches[0]).read()
        destination = root / executable
        destination.write_bytes(binary)
        destination.chmod(0o755)
        result = subprocess.run(
            [str(destination), "--capabilities"], stdin=subprocess.DEVNULL,
            capture_output=True, text=True, timeout=20,
        )
        if result.returncode != 0:
            raise AssertionError("Packaged CLI capabilities check failed")
        capabilities = json.loads(result.stdout)
        if capabilities.get("tool") != "zerynex" or capabilities.get("schema_version") != 1:
            raise AssertionError("Packaged CLI capabilities contract differs from source")
        if capabilities.get("max_decoded_pczt_bytes") != 8 * 1024 * 1024:
            raise AssertionError("Packaged CLI reports incorrect input limit")
        archive_version = archive.name.split("-")[1].removeprefix("v")
        if capabilities.get("cli_version") != archive_version:
            raise AssertionError("Packaged CLI version differs from release archive")
        for name in ("clean-v6.bin", "transparent-v6.bin"):
            shutil.copyfile(ROOT / "apps/web/public/examples" / name, root / name)
        checks = [("clean-v6.bin", 0), ("transparent-v6.bin", 2)]
        for name, status in checks:
            result = subprocess.run([str(destination), str(root / name),
                "--deny-transparent", "--json"],
                stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=20)
            if result.returncode != status:
                raise AssertionError(f"Compiled CLI mismatch for {name}: {result.returncode}")
            found_rule = "PCZT-TRANSPARENT-OUTPUTS" in result.stdout
            if found_rule != (status == 2):
                raise AssertionError("Unexpected policy report.")
        sarif = subprocess.run(
            [str(destination), str(root / "transparent-v6.bin"), "--deny-transparent", "--sarif"],
            stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=20,
        )
        if sarif.returncode != 2:
            raise AssertionError("Packaged CLI SARIF report exit status differs")
        structured = json.loads(sarif.stdout)
        if structured.get("version") != "2.1.0" or structured["runs"][0]["results"][0]["ruleId"] != "PCZT-TRANSPARENT-OUTPUTS":
            raise AssertionError("Packaged CLI lacks privacy-safe SARIF output")
        if "transparent-v6.bin" in sarif.stdout or str(root) in sarif.stdout or '"physicalLocation"' in sarif.stdout:
            raise AssertionError("Packaged CLI SARIF disclosed local input path")
        # Inspect a ZIP-321 URI from stdin; never expose the full request on argv.
        payment_name = 'zerynex-payreq.exe' if is_windows else 'zerynex-payreq'
        if is_windows:
            with zipfile.ZipFile(archive) as contents:
                members = [name for name in contents.namelist() if name.endswith('/' + payment_name)]
                assert len(members) == 1
                payment_bytes = contents.read(members[0])
        else:
            with tarfile.open(archive) as contents:
                members = [item for item in contents if item.name.endswith('/' + payment_name)]
                assert len(members) == 1
                payment_bytes = contents.extractfile(members[0]).read()
        pay_exec = root / payment_name
        pay_exec.write_bytes(payment_bytes)
        pay_exec.chmod(0o755)
        uri = 'zcash:tmEZhbWHTpdKMw5it8YDspUXSMGQyFwovpU?amount=1&message=PRIVATE_TEST_MARKER'
        check = subprocess.run([str(pay_exec), '--network', 'test'], input=uri,
            capture_output=True, text=True, timeout=20)
        assert check.returncode == 0
        assert json.loads(check.stdout)['total_zat'] == 100000000
        assert 'PRIVATE_TEST_MARKER' not in check.stdout + check.stderr
        reject = subprocess.run([str(pay_exec), '--network', 'main'], input=uri,
            capture_output=True, text=True, timeout=20)
        assert reject.returncode == 1 and not reject.stdout
        print('PACKAGED ZIP-321 CLI PASS: offline parser and secret-free output')
        print("PACKAGED CLI CONSUMER PASS:", archive.name,
              "- clean and transparent synthetic policies, SHA-256 verified")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    verify(parser.parse_args().archive)
