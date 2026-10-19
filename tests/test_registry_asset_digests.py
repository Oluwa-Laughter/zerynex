"""Release checksum verification must reject swapped or additional packages."""
import importlib.util
from pathlib import Path
import hashlib
from tempfile import TemporaryDirectory
import unittest
ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('digest_verification', ROOT/'scripts/verify-registry-asset-digests.py')
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)

class RegistryDigests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.npm = 'zerynex-sdk-0.2.0.tgz'
        self.whl = 'zerynex_python-0.2.0-py3-none-any.whl'
        self.tar = 'zerynex_python-0.2.0.tar.gz'
        lines=[]
        for name in (self.npm,self.whl,self.tar):
            data = (name+' reviewed package contents').encode()
            (self.root/name).write_bytes(data)
            lines.append(f'{hashlib.sha256(data).hexdigest()}  {name}')
        (self.root/'SHA256SUMS-registry.txt').write_text('\n'.join(lines)+'\n')
    def test_valid_npm_and_python_assets_independently(self):
        (self.root/self.whl).unlink()
        (self.root/self.tar).unlink()
        self.assertEqual(module.validate(self.root,'0.2.0','npm'),[self.npm])
        (self.root/self.npm).unlink()
        self.root.joinpath(self.whl).write_bytes((self.whl+' reviewed package contents').encode())
        self.root.joinpath(self.tar).write_bytes((self.tar+' reviewed package contents').encode())
        self.assertEqual(module.validate(self.root,'0.2.0','pypi'),[self.whl,self.tar])
    def test_tamper_duplicate_missing_checksum_and_extra_file_are_rejected(self):
        for change in ('tamper','duplicate','missing','extra','link'):
            with self.subTest(change=change), TemporaryDirectory() as tmp:
                copy=Path(tmp)
                for file in self.root.iterdir():
                    (copy/file.name).write_bytes(file.read_bytes())
                manifest=copy/'SHA256SUMS-registry.txt'
                if change=='tamper': (copy/self.npm).write_bytes(b'evil')
                elif change=='duplicate': manifest.write_text(manifest.read_text()+manifest.read_text().splitlines()[0]+'\n')
                elif change=='missing': manifest.write_text('\n'.join(manifest.read_text().splitlines()[1:])+'\n')
                elif change=='extra': (copy/'unexpected.tgz').write_bytes(b'package')
                else:
                    (copy/self.npm).unlink()
                    (copy/self.npm).symlink_to(self.root/self.npm)
                with self.assertRaises(module.DigestError): module.validate(copy,'0.2.0','npm')
    def test_invalid_versions_and_registries_fail(self):
        for ver,registry in [('v0.2.0','npm'),('0.2.0/..','pypi'),('0.2.0','unknown')]:
            with self.assertRaises(module.DigestError):module.validate(self.root,ver,registry)

if __name__=='__main__': unittest.main()
