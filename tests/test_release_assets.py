import hashlib
from pathlib import Path
import tempfile
import unittest
import importlib.util

spec = importlib.util.spec_from_file_location('release_assets', Path(__file__).resolve().parents[1] / 'scripts/prepare-release-assets.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
prepare = module.prepare


class ReleaseAssetsTest(unittest.TestCase):
    def test_flattens_and_validates_checksum(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'downloads'
            source.mkdir()
            artifacts = {'zerynex-v0.1-linux.tar.gz': b'native', 'zerynex-sdk.tgz': b'sdk', 'zerynex.whl': b'python'}
            for filename, contents in artifacts.items():
                (source / filename).write_bytes(contents)
            digest = hashlib.sha256(b'native').hexdigest()
            (source / 'SHA256SUMS-linux.txt').write_text(f'{digest}  zerynex-v0.1-linux.tar.gz\n')
            names = prepare(source, root / 'release')
            self.assertEqual(len(names), 4)
            self.assertEqual((root / 'release' / 'zerynex-sdk.tgz').read_bytes(), b'sdk')

    def test_rejects_tampering_and_duplicates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'downloads'
            source.mkdir()
            for filename in ['zerynex.tar.gz', 'zerynex-sdk.tgz', 'zerynex.whl']:
                (source / filename).write_bytes(b'ok')
            (source / 'SHA256SUMS-linux.txt').write_text('0'*64+'  zerynex.tar.gz\n')
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                prepare(source, root / 'out')
            (source / 'SHA256SUMS-linux.txt').unlink()
            nested = source / 'sub'
            nested.mkdir()
            (nested / 'zerynex.whl').write_bytes(b'duplicate')
            with self.assertRaisesRegex(ValueError, 'Duplicate'):
                prepare(source, root / 'out')


if __name__ == '__main__':
    unittest.main()
