import sys
from pathlib import Path
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'apps/browser'))
from boralances_browser import tor_status


class TorReadinessTests(unittest.TestCase):
    def test_current_bootstrap_and_live_proxy_are_both_required(self):
        with patch.object(tor_status, 'control_reply', return_value='250-status/bootstrap-phase=NOTICE BOOTSTRAP PROGRESS=100 TAG=done\r\n250 OK\r\n'), patch.object(tor_status, 'socks_available', return_value=True):
            self.assertTrue(tor_status.status()['ready'])
        with patch.object(tor_status, 'control_reply', return_value='PROGRESS=100'), patch.object(tor_status, 'socks_available', return_value=False):
            self.assertFalse(tor_status.status()['ready'])

    def test_partial_bootstrap_never_opens_network_access(self):
        with patch.object(tor_status, 'control_reply', return_value='PROGRESS=75'), patch.object(tor_status, 'socks_available') as proxy:
            report=tor_status.status()
        self.assertFalse(report['ready']); self.assertEqual(report['progress'],75)
        proxy.assert_not_called()

    def test_stopped_tor_and_corrupt_control_cookie_fail_closed(self):
        for error in (ConnectionRefusedError(), FileNotFoundError(), ValueError('Invalid cookie')):
            with self.subTest(error=type(error).__name__), patch.object(tor_status, 'control_reply', side_effect=error):
                self.assertFalse(tor_status.status()['ready'])
