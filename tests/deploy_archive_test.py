import hashlib
import importlib.util
import io
import os
import pathlib
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from collections import namedtuple

spec = importlib.util.spec_from_file_location('release_helper', pathlib.Path(__file__).parents[1] / 'deploy/apply-release.py')
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)
REVISION = 'a' * 40


class DeployArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.stage = self.root / 'stage'
        self.stage.mkdir(mode=0o700)

    def tearDown(self):
        self.temp.cleanup()

    def archive(self, extra=()):
        archive = self.root / 'release.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            for name, data, kind in [('REVISION', REVISION.encode(), tarfile.REGTYPE), ('SECURITY_VERSION', b'1', tarfile.REGTYPE), ('server.js', b'// test', tarfile.REGTYPE), *extra]:
                member = tarfile.TarInfo(name)
                member.type = kind
                member.size = len(data)
                member.linkname = '/tmp/not-allowed' if kind == tarfile.SYMTYPE else ''
                tar.addfile(member, io.BytesIO(data))
        return archive

    def test_valid_archive_and_bounded_atomic_copy(self):
        source = self.archive()
        target = self.root / 'copied.tar.gz'
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        helper.copy_archive(source, target, digest)
        helper.extract_archive(target, self.stage, REVISION)
        self.assertEqual((self.stage / 'REVISION').read_text(), REVISION)
        self.assertEqual((target.stat().st_mode & 0o777), 0o640)

    def test_fifo_and_symlink_are_rejected_before_reading(self):
        fifo = self.root / 'pipe'
        os.mkfifo(fifo)
        with self.assertRaises(ValueError):
            helper.copy_archive(fifo, self.root / 'out', '0' * 64)
        link = self.root / 'link'
        link.symlink_to(self.archive())
        with self.assertRaises(OSError):
            helper.copy_archive(link, self.root / 'out', '0' * 64)

    def test_oversized_copy_and_digest_leave_no_partial_package(self):
        source = self.archive()
        target = self.root / 'out'
        with self.assertRaises(ValueError):
            helper.copy_archive(source, target, '0' * 64, limit=8)
        with self.assertRaises(ValueError):
            helper.copy_archive(source, target, '0' * 64)
        self.assertFalse(target.exists())
        self.assertEqual(list(self.root.glob('.package-*')), [])

    def test_unsafe_members_are_rejected(self):
        for name, kind in [('../escape', tarfile.REGTYPE), ('/absolute', tarfile.REGTYPE), ('symlink', tarfile.SYMTYPE), ('REVISION', tarfile.REGTYPE)]:
            with self.subTest(name=name), tempfile.TemporaryDirectory(dir=self.root) as directory:
                archive = self.archive([(name, b'x', kind)])
                with self.assertRaises(ValueError):
                    helper.extract_archive(archive, pathlib.Path(directory), REVISION)
        self.assertFalse((self.root / 'escape').exists())

    def test_member_and_expanded_size_limits(self):
        for limits in [{'max_members': 2}, {'max_size': 8}]:
            with self.subTest(limits=limits), tempfile.TemporaryDirectory(dir=self.root) as directory:
                with self.assertRaises(ValueError):
                    helper.extract_archive(self.archive(), pathlib.Path(directory), REVISION, **limits)

    def test_reserve_includes_the_next_stage_budget(self):
        Usage = namedtuple('Usage', 'total used free')
        with patch.object(helper.shutil, 'disk_usage', return_value=Usage(10**12, 0, helper.FREE_RESERVE + 100)):
            helper.ensure_space(self.root, 100)
            with self.assertRaises(ValueError):
                helper.ensure_space(self.root, 101)

    def test_disk_check_failure_cleans_partial_copy(self):
        source = self.archive()
        target = self.root / 'out'
        def exhausted(_size):
            raise ValueError('No reserve')
        with self.assertRaises(ValueError):
            helper.copy_archive(source, target, hashlib.sha256(source.read_bytes()).hexdigest(), space_check=exhausted)
        self.assertFalse(target.exists())
        self.assertEqual(list(self.root.glob('.package-*')), [])

    def test_bounded_reader_stops_compressed_expansion(self):
        reader = helper.BoundedReader(io.BytesIO(b'x' * 200), 100)
        self.assertEqual(len(reader.read(60)), 60)
        with self.assertRaises(ValueError):
            reader.read(60)


if __name__ == '__main__':
    unittest.main()
