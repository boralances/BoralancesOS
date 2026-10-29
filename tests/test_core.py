import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps/browser'))
from boralances_browser.model import atomic_json, navigate, read_json, safe_bookmarks


class NavigationTests(unittest.TestCase):
    def test_web_addresses(self):
        self.assertEqual(navigate('https://example.org/path?a=1'), 'https://example.org/path?a=1')
        self.assertEqual(navigate('example.org/docs'), 'https://example.org/docs')
        self.assertEqual(navigate('localhost:8080/test'), 'http://localhost:8080/test')

    def test_search_and_utf8(self):
        self.assertIn('q=merhaba+d%C3%BCnya', navigate('merhaba dünya'))
        self.assertEqual(navigate('   '), '')

    def test_unsafe_schemes_become_search_text(self):
        for value in ('javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hello', 'wine foo.exe'):
            self.assertTrue(navigate(value).startswith('https://www.google.com/search?q='), value)

    def test_bookmark_schema_and_schemes(self):
        value = [{'title': 'Good', 'url': 'https://example.org'}, {'title': 'Bad', 'url': 'javascript:alert(1)'},
                 {'title': None, 'url': 'https://example.org'}, 'wrong']
        self.assertEqual(safe_bookmarks(value), value[:1])
        self.assertEqual(safe_bookmarks({}), [])


class StateTests(unittest.TestCase):
    def test_atomic_unicode_state_and_corrupt_fallback(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'state.json'
            atomic_json(path, {'title': 'Bora · çalışma'})
            self.assertEqual(read_json(path, {}), {'title': 'Bora · çalışma'})
            self.assertEqual(list(Path(folder).glob('.state-*')), [])
            path.write_text('{', encoding='utf-8')
            self.assertEqual(read_json(path, {'fallback': True}), {'fallback': True})


class IntegrationTests(unittest.TestCase):
    def test_imports_match_recorded_digests(self):
        manifest = json.loads((ROOT / 'integrations/import-manifest.json').read_text())
        self.assertGreater(len(manifest['files']), 300)
        for record in manifest['files']:
            file = ROOT / record['path']
            self.assertTrue(file.is_relative_to(ROOT))
            self.assertEqual(hashlib.sha256(file.read_bytes()).hexdigest(), record['sha256'], record['path'])

    def test_no_personal_data_or_windows_binaries_imported(self):
        for base in ('vendor', 'integrations/android', 'apps/browser/boralances_browser/web'):
            for path in (ROOT / base).rglob('*'):
                if not path.is_file():
                    continue
                self.assertNotIn(path.suffix.lower(), {'.exe', '.dll', '.p12', '.pfx', '.key', '.log'})
                self.assertFalse(set(path.relative_to(ROOT).parts) & {'data', 'profile', '.release-keys', '.runtime'})

    def test_provider_credentials_removed(self):
        source = (ROOT / 'vendor/boralances-launcher/src/provider-defaults.cjs').read_text()
        self.assertIn('process.env.CURSEFORGE_API_KEY', source)
        self.assertNotRegex(source, r'\$2[aby]\$')

    def test_launcher_uses_native_runtimes_and_secure_storage(self):
        source = (ROOT / 'vendor/boralances-launcher/src/main.cjs').read_text()
        self.assertIn("process.platform==='linux' && process.env.BORALANCES_PYTHON", source)
        self.assertIn("getSelectedStorageBackend()!=='basic_text'", source)
        self.assertIn('autoCheck:false,supported:false', source)
        self.assertIn("javaRelative:(settings.java||process.platform==='linux')?null:", source)
        self.assertIn("process.env['BORALANCES_JAVA_'+instance.javaMajor]", source)
        self.assertIn('BORALANCES_GAMEMODERUN', source)
        worker = (ROOT / 'vendor/boralances-launcher/backend/worker.py').read_text()
        self.assertIn("os.environ.get('BORALANCES_JAVA_' + str(major))", worker)

    def test_application_registry(self):
        apps = json.loads((ROOT / 'integrations/applications.json').read_text())['applications']
        ids = [app['id'] for app in apps]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertTrue({'browser', 'launcher', 'jarvis', 'glass', 'chat', 'minecraft-client'} <= set(ids))


if __name__ == '__main__':
    unittest.main()
