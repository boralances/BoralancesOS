import importlib.util,json,subprocess,tempfile,unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
def load(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'apps/companions'/(name+'.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
account=load('account_setup');hardware=load('hardware_tools')
disks=load('disk_setup')
device_data=load('device_data')

class AudioRoutingTests(unittest.TestCase):
    def test_microphone_picker_excludes_output_monitor_streams(self):
        values=[{'name':'alsa_input.usb','description':'USB microphone','properties':{'device.class':'sound'}},{'name':'alsa_output.stereo.monitor','description':'Output monitor'},{'name':'loopback','properties':{'device.class':'monitor'}}]
        self.assertEqual(device_data.audio_devices(json.dumps(values)),[('alsa_input.usb','USB microphone')])

    def test_device_report_rejects_invalid_shape(self):
        with self.assertRaises(ValueError):device_data.audio_devices('{}')

class InstallerAccountTests(unittest.TestCase):
    def test_identity_validation_rejects_reserved_and_shell_names(self):
        for name in ('root','nixos','greeter','UPPER','a;touch test','../alex',''):
            with self.subTest(name=name),self.assertRaises(ValueError):account.validate_account({'username':name,'fullName':'Alex','password':'good-passphrase'})

    def test_password_validation_accepts_passphrase_and_rejects_line_breaks(self):
        value={'username':'alex','fullName':'Alex Example','password':'a strong passphrase'}
        self.assertEqual(account.validate_account(value)[0],'alex')
        for password in ('short','bad\npassword','bad\0password'):
            with self.assertRaises(ValueError):account.validate_account({**value,'password':password})

    def test_account_metadata_never_contains_password(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(account.subprocess,'run') as process:
                account.prepare({'username':'alex','fullName':'Alex Example','password':'keep-this-private'},directory,metadata_only=True)
                process.assert_not_called()
            value=json.loads((Path(directory)/'account.json').read_text())
            self.assertEqual(value,{'username':'alex','fullName':'Alex Example'})

class BlankDiskTests(unittest.TestCase):
    def test_only_unused_whole_blank_disks_are_offered(self):
        blank={'type':'disk','size':40*1024**3,'ro':False,'mountpoints':[None],'fstype':None}
        self.assertTrue(disks.eligible(blank))
        for changes in ({'children':[{'type':'part'}]},{'fstype':'ntfs'},{'ro':True},{'mountpoints':['/']},{'type':'part'},{'size':8*1024**3}):
            with self.subTest(changes=changes):self.assertFalse(disks.eligible({**blank,**changes}))

class NativeGpuTests(unittest.TestCase):
    def test_prime_bus_ids_convert_hexadecimal_bus_addresses(self):
        self.assertEqual(hardware.pci_bus_id('0000:0a:02.0'),'PCI:10@0:2:0')
        with self.assertRaises(ValueError):hardware.pci_bus_id('00:00;bad')

    def test_hybrid_gpu_profile_uses_detected_devices(self):
        text=hardware.nvidia_module([{'address':'0000:00:02.0','vendor':'0x8086'},{'address':'0000:01:00.0','vendor':'0x10de'}])
        self.assertIn('intelBusId = "PCI:0@0:2:0"',text);self.assertIn('nvidiaBusId = "PCI:1@0:0:0"',text)
        self.assertIn('offload.enable = true',text)
        with self.assertRaises(ValueError):hardware.nvidia_module([])

    def test_ryzen_nvidia_hybrid_uses_amdgpu_prime_bus(self):
        text=hardware.nvidia_module([{'address':'0000:05:00.0','vendor':'0x1002'},{'address':'0000:01:00.0','vendor':'0x10de'}])
        self.assertIn('amdgpuBusId = "PCI:5@0:0:0"',text)
        self.assertNotIn('intelBusId',text)

    def test_amd_profile_keeps_32bit_vulkan_and_early_amdgpu(self):
        text=hardware.amd_module([{'address':'0000:05:00.0','vendor':'0x1002'}])
        self.assertIn('enable32Bit = true',text);self.assertIn('kernelModules = [ "amdgpu" ]',text)
        with self.assertRaises(ValueError):hardware.amd_module([])
        with self.assertRaises(ValueError):hardware.amd_module([{'vendor':'0x1002'},{'vendor':'0x10de'}])

    def test_vm_never_receives_host_nvidia_driver_configuration(self):
        with patch.object(hardware,'virtual_machine',return_value=True),patch.object(hardware,'graphics_devices') as devices:
            with self.assertRaises(SystemExit):hardware.install_nvidia()
            devices.assert_not_called()

    def test_driver_catalog_accepts_known_rtx_and_rejects_unknown_device(self):
        self.assertEqual(hardware.check_nvidia_support([{'vendor':'0x10de','device':'0x25a2'}]),'595.71.05')
        with self.assertRaises(ValueError):hardware.check_nvidia_support([{'vendor':'0x10de','device':'0xdead'}])

    def test_installation_graphics_never_writes_physical_profile_for_vm(self):
        with tempfile.TemporaryDirectory() as directory,patch.object(hardware,'virtual_machine',return_value=True):
            hardware.prepare_installation_graphics(directory)
            self.assertFalse((Path(directory)/'drivers.local.nix').exists())
