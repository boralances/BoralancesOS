import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('desktop_control', ROOT / 'scripts/control.py')
control = importlib.util.module_from_spec(spec)
with patch('os.getuid', return_value=1000, create=True):
    spec.loader.exec_module(control)


class DesktopRegressionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        config = Path(self.temp.name)
        for name, value in {'CONFIG': config, 'STATE': config / 'boralances/state.json',
                            'RUNTIME': config / 'run', 'SYSTEM_BAR_CONFIG': ROOT / 'config/waybar/config.jsonc'}.items():
            self.enterContext(patch.object(control, name, value))

    def test_dock_is_visible_and_reserves_space_by_default(self):
        with patch.object(control, 'read_state', return_value={}), patch.object(control.os, 'execvp') as execute:
            with patch.object(control.sys, 'argv', ['control', 'dock-run']):
                control.main()
        args = execute.call_args.args[1]
        self.assertIn('-x', args)
        self.assertNotIn('-d', args)

    def test_dock_autohide_requires_explicit_user_choice(self):
        control.save_state({'dock-autohide': 'true', 'dock-position': 'left', 'dock-size': '40'})
        with patch.object(control.os, 'execvp') as execute, patch.object(control.sys, 'argv', ['control', 'dock-run']):
            control.main()
        args = execute.call_args.args[1]
        self.assertIn('-d', args)
        self.assertNotIn('-x', args)
        self.assertEqual(args[args.index('-p') + 1], 'left')

    def test_restarted_service_sees_new_preference_and_failure_restores_state(self):
        original = {'theme': 'dark', 'dock-size': '48'}
        control.save_state(original)
        def restart(_key, _state):
            self.assertEqual(control.read_state()['dock-size'], '64')
            raise OSError('service unavailable')
        with patch.object(control, 'apply_preference', side_effect=restart):
            with patch.object(control.sys, 'argv', ['control', 'set', 'dock-size', '64']):
                with self.assertRaises(OSError):
                    control.main()
        self.assertEqual(control.read_state(), original)

    def test_preference_values_cannot_become_shell_commands(self):
        with patch.object(control, 'apply_preference') as apply:
            with patch.object(control.sys, 'argv', ['control', 'set', 'dock-size', '48; shutdown now']):
                with self.assertRaises(ValueError):
                    control.main()
            apply.assert_not_called()

    def test_resource_meters_are_optional_and_clock_is_configurable(self):
        config = json.loads(control.shell_config({}).read_text())
        self.assertNotIn('cpu', config['modules-right'])
        changed = json.loads(control.shell_config({'menu-details': 'true', 'clock-format': '12h'}).read_text())
        self.assertIn('cpu', changed['modules-right'])
        self.assertIn('%I', changed['clock']['format'])

    def test_window_cycling_stays_on_current_desktop_and_skips_quick_settings(self):
        windows=[{'address':'0xa','mapped':True,'workspace':{'id':1},'class':'foot'},
                 {'address':'0xb','mapped':True,'workspace':{'id':2},'class':'thunar'},
                 {'address':'0xc','mapped':True,'workspace':{'id':1},'class':'boralances-quick-settings'},
                 {'address':'0xd','mapped':True,'workspace':{'id':1},'class':'thunar'}]
        with patch.object(control,'clients',return_value=windows), patch.object(control,'active_window',return_value=windows[0]), patch.object(control,'run') as run, patch.object(control,'dispatch') as dispatch:
            run.return_value.stdout='{"id":1}'
            control.cycle_window()
            self.assertEqual(dispatch.call_args_list, [
                unittest.mock.call('focus', {'window':'address:0xd'}),
                unittest.mock.call('window.bring_to_top', {})])

    def test_show_desktop_restores_only_its_own_surviving_windows(self):
        control.RUNTIME.mkdir()
        windows=[{'address':'0xa','mapped':True,'workspace':{'id':1}}, {'address':'0xb','mapped':True,'workspace':{'id':2}}]
        with patch.object(control,'clients',return_value=windows), patch.object(control,'run') as run, patch.object(control,'dispatch') as dispatch:
            run.return_value.stdout='{"id":1}'
            control.parked_windows('show-desktop')
            self.assertEqual(dispatch.call_args.args[1]['window'],'address:0xa')
            self.assertFalse(dispatch.call_args.args[1]['follow'])
            dispatch.reset_mock()
            control.parked_windows('show-desktop')
            self.assertEqual(dispatch.call_args_list[0].args,('window.move',{'window':'address:0xa','workspace':'1','follow':False}))
            self.assertEqual(json.loads((control.RUNTIME/'desktop-windows.json').read_text()),[])

    def test_snap_leaves_room_for_top_bar_and_dock(self):
        window={'address':'0xa','monitor':0}
        monitor={'id':0,'width':1280,'height':800,'scale':1,'x':0,'y':0,'reserved':[0,36,0,88]}
        with patch.object(control,'active_window',return_value=window), patch.object(control,'run') as run, patch.object(control,'dispatch') as dispatch:
            run.return_value.stdout=json.dumps([monitor]); control.snap_window('right')
        calls=dispatch.call_args_list
        self.assertEqual(calls[-2].args,('window.resize',{'window':'address:0xa','x':624,'y':656}))
        self.assertEqual(calls[-1].args,('window.move',{'window':'address:0xa','x':650,'y':46}))

    def test_desktop_minimize_never_moves_a_window_on_another_workspace(self):
        other={'address':'0xa','mapped':True,'workspace':{'id':2}}
        with patch.object(control,'clients',return_value=[other]), patch.object(control,'run') as run, patch.object(control,'dispatch') as dispatch:
            run.return_value.stdout='{"id":1}'
            control.RUNTIME.mkdir(parents=True,exist_ok=True)
            control.parked_windows('minimize','0xa')
        dispatch.assert_not_called()

    @unittest.skipIf(__import__('sys').platform == 'win32', 'POSIX read-only seed semantics')
    def test_read_only_seed_file_can_be_replaced_by_its_owner(self):
        path = control.CONFIG / 'dock/style.css'
        path.parent.mkdir()
        path.write_text('old')
        path.chmod(0o444)
        control.write_config(path, 'new')
        self.assertEqual(path.read_text(), 'new')
        self.assertTrue(path.stat().st_mode & 0o200)


if __name__ == '__main__':
    unittest.main()
