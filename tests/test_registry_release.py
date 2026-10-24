"""Offline release safety, metadata and artifact shape regressions."""
from __future__ import annotations
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tarfile
from tempfile import TemporaryDirectory
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('registry_release', ROOT / 'scripts/check-registry-release.py')
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class RegistryReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for path in ('packages/sdk/package.json', 'packages/python/pyproject.toml', 'Cargo.toml',
                     'apps/web/package.json', 'packages/go/go.mod', 'packages/sdk/bin/refund-check.mjs'):
            dest = self.root / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / path, dest)

    def test_source_metadata_versions_imports_and_registry_identity(self):
        self.assertEqual(module.metadata(self.root), '0.2.0')
        self.assertEqual(module.metadata(ROOT), '0.2.0')

    def test_wrong_export_or_missing_binary_fails_closed(self):
        file = self.root / 'packages/sdk/package.json'
        original = json.loads(file.read_text())
        tampered = json.loads(file.read_text())
        tampered['exports']['.']['bin'] = {'zerynex-refund-check': './bin/refund-check.mjs'}
        file.write_text(json.dumps(tampered))
        with self.assertRaises(module.RegistryReleaseError):module.metadata(self.root)
        file.write_text(json.dumps(original))
        (self.root / 'packages/sdk/bin/refund-check.mjs').unlink()
        with self.assertRaises(module.RegistryReleaseError):module.metadata(self.root)

    def test_cross_language_version_drift_fails_closed(self):
        file = self.root / 'packages/python/pyproject.toml'
        file.write_text(file.read_text().replace('version = "0.2.0"','version = "0.1.0"',1))
        with self.assertRaises(module.RegistryReleaseError):module.metadata(self.root)

    def test_repository_identity_and_public_scope_are_required(self):
        file = self.root / 'packages/sdk/package.json'
        source = json.loads(file.read_text())
        for key, altered in [('repository', {'url':'https://github.com/stranger/project','directory':'packages/sdk'}),
                             ('publishConfig', {'access':'restricted'})]:
            with self.subTest(key=key):
                obj = dict(source)
                obj[key] = altered
                file.write_text(json.dumps(obj))
                with self.assertRaises(module.RegistryReleaseError):module.metadata(self.root)

    def build_npm(self, good=True):
        archive = self.root / 'zerynex-sdk-0.2.0.tgz'
        pkg = json.loads((ROOT / 'packages/sdk/package.json').read_text())
        files = {
            'package/package.json':json.dumps(pkg).encode(),
            'package/bin/refund-check.mjs':b'#!/usr/bin/env node\n',
            'package/dist/index.js':b'export const x=1;\n',
            'package/dist/index.d.ts':b'export declare const x: number;\n',
            'package/dist/browser.js':b'export {};\n',
            'package/dist/wasm/zerynex_bg.wasm':bytes([0,97,115,109,1,0,0,0]),
        }
        if not good: del files['package/bin/refund-check.mjs']
        with tarfile.open(archive,'w:gz') as tar:
            for name,data in files.items():
                info=tarfile.TarInfo(name)
                info.size=len(data)
                tar.addfile(info,io.BytesIO(data))
        return archive

    def test_npm_archive_requires_cli_wasm_and_valid_exports(self):
        self.assertIsNone(module.npm_tarball(self.build_npm(), '0.2.0'))
        with self.assertRaises(module.RegistryReleaseError):
            module.npm_tarball(self.build_npm(False),'0.2.0')

    def test_python_wheel_metadata_is_versioned_and_includes_tools(self):
        path = self.root / 'zerynex_python-0.2.0-py3-none-any.whl'
        with zipfile.ZipFile(path,'w') as archive:
            archive.writestr('zerynex_python-0.2.0.dist-info/METADATA',
                             'Metadata-Version: 2.3\nName: zerynex-python\nVersion: 0.2.0\n')
            archive.writestr('zerynex_python-0.2.0.dist-info/entry_points.txt',
                             '[console_scripts]\nzerynex-refund-audit = zerynex_py.refund_privacy:main\nzerynex-project = zerynex_py.project:main\nzerynex-zallet-fixture-check = zerynex_py.zallet_fixture:main\n')
            archive.writestr('zerynex_py/zallet_fixture.py', 'def main(): pass\n')
        self.assertIsNone(module.python_wheel(path, '0.2.0'))
        with self.assertRaises(module.RegistryReleaseError):module.python_wheel(path,'0.1.0')


if __name__ == '__main__':unittest.main()
