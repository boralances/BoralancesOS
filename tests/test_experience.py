import contextlib
import importlib.util
import io
from pathlib import Path
import shlex
import sys
import unittest
import tempfile
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/browser'))
from boralances_browser.tor_policy import chromium_flags
spec=importlib.util.spec_from_file_location('system_cli',ROOT/'apps/system_cli.py')
cli=importlib.util.module_from_spec(spec); spec.loader.exec_module(cli)
sys.path.insert(0,str(ROOT/'apps/companions'))
import app_catalog


class TorPolicyTests(unittest.TestCase):
    def test_existing_direct_proxy_settings_cannot_bypass_tor(self):
        flags=shlex.split(chromium_flags('--disable-gpu --no-proxy-server --proxy-server=direct:// --proxy-bypass-list=*'))
        self.assertIn('--disable-gpu',flags)
        self.assertIn('--proxy-server=socks5://127.0.0.1:9050',flags)
        self.assertNotIn('--no-proxy-server',flags)
        self.assertNotIn('--proxy-bypass-list=*',flags)
        self.assertIn('--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost',flags)
        self.assertIn('--force-webrtc-ip-handling-policy=disable_non_proxied_udp',flags)
        self.assertNotIn('--no-sandbox',flags)


class CliTests(unittest.TestCase):
    def test_profile_uses_argument_vector_and_rejects_unknown_values(self):
        with patch.object(sys,'argv',['boralancesos','profile','fluid']), patch.object(cli.subprocess,'run') as execute:
            execute.return_value.returncode=0
            self.assertEqual(cli.main(),0)
        execute.assert_called_once_with(['boralances-control','profile','fluid'],check=False)
        with patch.object(sys,'argv',['boralancesos','profile','fluid; reboot']), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit): cli.main()

    def test_kali_dry_run_after_action_never_executes_installation(self):
        stream=io.StringIO()
        with patch.object(sys,'argv',['boralancesos','kali','install','--dry-run']), patch.object(cli.subprocess,'run') as execute, contextlib.redirect_stdout(stream):
            self.assertEqual(cli.main(),0)
        execute.assert_not_called()
        self.assertIn('nmap',stream.getvalue())
        self.assertIn('No host mounts',stream.getvalue())

    def test_steam_install_reports_existing_package_without_downloading(self):
        with patch.object(sys,'argv',['boralancesos','steam','install']), patch.object(cli.shutil,'which',return_value='/run/current-system/sw/bin/steam'), patch.object(cli.subprocess,'run') as execute, contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(cli.main(),0)
        execute.assert_not_called()


class CatalogTests(unittest.TestCase):
    def test_switcher_includes_other_desktops_and_minimized_browser(self):
        clients=[{'address':'0x1','mapped':True,'class':'boralances-browser','workspace':{'id':2,'name':'2'}},
            {'address':'0x2','mapped':True,'class':'boralances-browser','workspace':{'id':-99,'name':'special:boralances-minimized'}},
            {'address':'0x3','mapped':True,'class':'boralances-center','workspace':{'id':1,'name':'1'}}]
        self.assertEqual([w['address'] for w in app_catalog.switcher_clients(clients)],['0x1','0x2'])
    def test_hidden_user_override_masks_system_entry_and_pins_are_unique(self):
        with tempfile.TemporaryDirectory() as temporary:
            home=Path(temporary); user=home/'user'; system=home/'system'; user.mkdir(); system.mkdir()
            (user/'example.desktop').write_text('[Desktop Entry]\nType=Application\nHidden=true\n')
            (system/'example.desktop').write_text('[Desktop Entry]\nType=Application\nName=Example\nExec=example\n')
            (system/'files.desktop').write_text('[Desktop Entry]\nType=Application\nName=Files\nExec=thunar\n')
            known=app_catalog.applications([user,system])
            self.assertEqual([item['id'] for item in known],['files'])
            with patch.dict(app_catalog.os.environ,{'XDG_CACHE_HOME':str(home/'cache')}):
                app_catalog.set_pin('files',True,known); app_catalog.set_pin('files',True,known)
                self.assertEqual(app_catalog.pinned(),['files'])
                with self.assertRaises(ValueError): app_catalog.set_pin('../invalid',True,known)
                app_catalog.set_pin('files',False,known)
                self.assertEqual(app_catalog.pinned(),[])
