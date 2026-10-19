"""Offline unit tests for crate release boundaries."""
import importlib.util
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('crate_boundary',ROOT/'scripts/check-crate-package.py')
module=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)
class CrateBoundary(unittest.TestCase):
    def test_minimal_crate_is_allowed(self):
        self.assertIsNone(module.validate(sorted(module.REQUIRED)))
    def test_monorepo_web_and_runtime_deps_are_rejected(self):
        for name in ('apps/web/src/Story.tsx','apps/web/node_modules/.pnpm/pkg/LICENSE',
                     '.github/workflows/ci.yml','packages/sdk/package.json',
                     'docs/deployment.md','apps/web/public/wasm/zerynex_bg.wasm'):
            with self.subTest(name=name),self.assertRaises(ValueError):
                module.validate([*module.REQUIRED,name])
    def test_too_many_files_and_required_fixture_absence_fail(self):
        with self.assertRaises(ValueError):module.validate(sorted(module.REQUIRED-{'src/lib.rs'}))
        with self.assertRaises(ValueError):module.validate([*module.REQUIRED]*20)
if __name__=='__main__': unittest.main()
