"""No push-triggered publication or credentials in Zerynex registry workflow."""
import re
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
WORKFLOW=ROOT/'.github/workflows/registry-publish.yml'
DISTRIBUTIONS=ROOT/'.github/workflows/distributions.yml'

class RegistryPublishWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.source=WORKFLOW.read_text()
        # Parse job boundaries independently of third-party YAML packages.
        self.sections={}
        current=None
        for line in self.source.splitlines(keepends=True):
            match=re.match(r'^  (preflight|npm-publish|pypi-publish):\s*$',line)
            if match:
                current=match.group(1)
                self.sections[current]=''
            elif current:
                self.sections[current]+=line

    def test_manual_dispatch_and_deliberate_confirmation_only(self):
        header=self.source.split('\njobs:\n',1)[0]
        self.assertRegex(header,r'(?m)^on:\n  workflow_dispatch:')
        for forbidden in ('\n  push:','\n  pull_request:','\n  schedule:','\n  workflow_run:','\n  workflow_call:'):
            self.assertNotIn(forbidden,header)
        self.assertIn('PUBLISH-${VERSION_TAG}-${REGISTRY}',self.source)
        self.assertIn("github.ref == 'refs/heads/main'",self.source)
        self.assertIn('refs/tags/$VERSION_TAG^{commit}',self.source)
        self.assertIn('gh release view',self.source)
        self.assertIn('isDraft == false',self.source)
        self.assertIn('isPrerelease == false',self.source)

    def test_npm_and_python_are_separate_approved_jobs(self):
        self.assertEqual(set(self.sections),{'preflight','npm-publish','pypi-publish'})
        self.assertIn("if: inputs.registry == 'npm'",self.sections['npm-publish'])
        self.assertIn("if: inputs.registry == 'pypi'",self.sections['pypi-publish'])
        self.assertIn('name: npm-publish',self.sections['npm-publish'])
        self.assertIn('name: pypi-publish',self.sections['pypi-publish'])
        for name in ('npm-publish','pypi-publish'):
            self.assertIn('id-token: write',self.sections[name])
            self.assertIn('needs: preflight',self.sections[name])
            self.assertIn('verify-registry-asset-digests.py',self.sections[name])
            self.assertIn('check-registry-release.py',self.sections[name])
            self.assertIn('gh release download',self.sections[name])
        self.assertNotIn('id-token: write',self.sections['preflight'])
        self.assertIn('npm publish',self.sections['npm-publish'])
        self.assertIn('gh-action-pypi-publish@release/v1',self.sections['pypi-publish'])

    def test_never_build_or_read_registry_credentials_during_publication(self):
        text=self.source
        for forbidden in ('NPM_TOKEN','PYPI_TOKEN','TWINE_PASSWORD',
                          'cargo publish','npm pack','python -m build','pnpm build',
                          'npm run build','gh release create','git push'):
            self.assertNotIn(forbidden,text)
        self.assertIn('persist-credentials: false',text)
        self.assertIn('--ignore-scripts',self.sections['npm-publish'])

    def test_explicit_tagged_release_generates_registry_checksum_manifest(self):
        text=DISTRIBUTIONS.read_text()
        self.assertIn("if: startsWith(github.ref, 'refs/tags/v')",text)
        self.assertIn('SHA256SUMS-registry.txt',text)
        self.assertIn('sha256sum zerynex-sdk-*.tgz zerynex_python-*.whl',text)
        self.assertIn('gh release create',text)
        self.assertIn('release-assets/*',text)

if __name__=='__main__':unittest.main()
