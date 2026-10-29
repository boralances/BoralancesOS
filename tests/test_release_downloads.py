"""Check release assembly, restart recovery, and refusal to overwrite user files."""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('release_download',ROOT/'design/os-site/downloads/get-boralancesos.py')
download=importlib.util.module_from_spec(spec);spec.loader.exec_module(download)

class ReleaseDownloadTests(unittest.TestCase):
    def fixture(self,folder):
        content=[b'BoralancesOS ',b'verified ',b'release fixture.\n'];parts=[]
        for index,data in enumerate(content):
            name=f'test.iso.part{index+1:03}';(folder/name).write_bytes(data)
            parts.append({'name':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'url':'https://example.invalid/'+name})
        whole=b''.join(content)
        return {'published':False,'artifacts':[{'id':'iso','ready':True,'file':'test.iso','bytes':len(whole),'sha256':hashlib.sha256(whole).hexdigest(),'parts':parts}]},whole

    def assemble(self,*arguments):
        with contextlib.redirect_stdout(io.StringIO()):return download.assemble(*arguments)

    def test_assembly_reconstructs_original_and_verifies_existing_file(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder=Path(temporary);manifest,whole=self.fixture(folder)
            target=self.assemble(manifest,folder,'iso',folder/'output')
            self.assertEqual(target.read_bytes(),whole)
            self.assertEqual(self.assemble(manifest,folder,'iso',folder/'output'),target)

    def test_corrupt_part_stops_before_appending_and_resume_recovers(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder=Path(temporary);manifest,whole=self.fixture(folder);second=folder/manifest['artifacts'][0]['parts'][1]['name'];original=second.read_bytes();second.write_bytes(b'corrupt')
            with self.assertRaises(ValueError):self.assemble(manifest,folder,'iso',folder/'output')
            self.assertFalse((folder/'output/test.iso').exists())
            self.assertEqual((folder/'output/test.iso.partial').read_bytes(),b'BoralancesOS ')
            second.write_bytes(original);self.assertEqual(self.assemble(manifest,folder,'iso',folder/'output').read_bytes(),whole)

    def test_manifest_cannot_escape_destination_directory(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder=Path(temporary);manifest,_=self.fixture(folder);manifest['artifacts'][0]['parts'][0]['name']='../outside'
            with self.assertRaises(ValueError):self.assemble(manifest,folder,'iso',folder/'output')
            self.assertFalse((folder/'outside').exists())

    def test_existing_different_file_is_preserved(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder=Path(temporary);manifest,_=self.fixture(folder);output=folder/'output';output.mkdir();target=output/'test.iso';target.write_bytes(b'my existing file')
            with self.assertRaises(ValueError):self.assemble(manifest,folder,'iso',output)
            self.assertEqual(target.read_bytes(),b'my existing file')
