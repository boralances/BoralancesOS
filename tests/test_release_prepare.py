import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
prepare=module('prepare_release',ROOT/'scripts/prepare-release.py')
download=module('download_release',ROOT/'design/os-site/downloads/get-boralancesos.py')

class ReleasePreparationTests(unittest.TestCase):
    def test_low_space_stops_before_creating_image_parts(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);iso=root/'test.iso';kit=root/'kit.zip'
            iso.write_bytes(b'image');kit.write_bytes(b'kit')
            with patch.object(prepare.shutil,'disk_usage',return_value=type('Disk',(),{'free':0})()):
                with self.assertRaises(OSError):prepare.prepare(iso,kit,root/'release',chunk_size=7)
            self.assertEqual(list((root/'release').iterdir()),[])

    def test_prepared_parts_reconstruct_original_and_preserve_existing_different_data(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);iso=root/'test.iso';kit=root/'kit.zip';iso.write_bytes(b'verified image contents');kit.write_bytes(b'kit')
            manifest=prepare.prepare(iso,kit,root/'release',chunk_size=7)
            result=download.assemble(manifest,root/'release','iso',root/'assembled')
            self.assertEqual(result.read_bytes(),iso.read_bytes());self.assertFalse(manifest['published'])
            part=root/'release'/manifest['artifacts'][0]['parts'][0]['name'];part.write_bytes(b'user data')
            with self.assertRaises(FileExistsError):prepare.prepare(iso,kit,root/'release',chunk_size=7)
            self.assertEqual(part.read_bytes(),b'user data')
