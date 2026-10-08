#!/usr/bin/env python3
"""Root-owned, bounded dispatcher. Release code runs only under service UIDs."""
import fcntl
import gzip
import hashlib
import json
import os
import pathlib
import re
import resource
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import time

BASE = pathlib.Path('/srv/my-projects')
MAX_ARCHIVE = 256 * 1024 * 1024
MAX_EXPANDED = 1500 * 1024 * 1024
MAX_MEMBERS = 100000
FREE_RESERVE = 3 * 1024 * 1024 * 1024
MAX_DUMP = 2 * 1024 * 1024 * 1024


def run(*args, **kwargs):
    return subprocess.run(args, check=True, timeout=150, **kwargs)


def ensure_space(path, additional=0):
    if shutil.disk_usage(path).free < FREE_RESERVE + additional:
        raise ValueError('Insufficient reserved disk space')


def copy_archive(source, target, expected_digest, limit=MAX_ARCHIVE, space_check=None):
    # O_NONBLOCK prevents a malicious FIFO from hanging before fstat can reject it.
    fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    temporary = None
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
            raise ValueError('Invalid archive file or size')
        out_fd, temporary = tempfile.mkstemp(prefix='.package-', dir=target.parent)
        size = 0
        digest = hashlib.sha256()
        with os.fdopen(out_fd, 'wb') as output:
            while True:
                chunk = os.read(fd, min(1024 * 1024, limit - size + 1))
                if not chunk:
                    break
                size += len(chunk)
                if size > limit:
                    raise ValueError('Archive byte limit exceeded')
                if space_check:
                    space_check(len(chunk))
                output.write(chunk)
                digest.update(chunk)
            output.flush()
            os.fsync(output.fileno())
        if digest.hexdigest() != expected_digest:
            raise ValueError('Archive digest mismatch')
        os.chmod(temporary, 0o640)
        os.replace(temporary, target)
        temporary = None
    finally:
        os.close(fd)
        if temporary:
            pathlib.Path(temporary).unlink(missing_ok=True)


class BoundedReader:
    def __init__(self, source, limit):
        self.source, self.limit, self.used = source, limit, 0

    def read(self, size=-1):
        # TAR metadata must never cause an unbounded individual allocation.
        if size < 0 or size > 1024 * 1024:
            raise ValueError('Archive read too large')
        chunk = self.source.read(min(size, self.limit - self.used + 1))
        self.used += len(chunk)
        if self.used > self.limit:
            raise ValueError('Expanded archive limit exceeded')
        return chunk


def extract_archive(archive, staging, revision, max_members=MAX_MEMBERS, max_size=MAX_EXPANDED, space_check=None):
    total, count, seen = 0, 0, set()
    with gzip.open(archive, 'rb') as compressed:
        with tarfile.open(fileobj=BoundedReader(compressed, max_size + 100 * 1024 * 1024), mode='r|') as tar:
            for member in tar:
                # Do not retain the entire member table in memory.
                tar.members.clear()
                count += 1
                total += member.size
                if count > max_members or total > max_size:
                    raise ValueError('Archive entry limit exceeded')
                path = pathlib.PurePosixPath(member.name)
                if (path.is_absolute() or '..' in path.parts or len(member.name) > 4096
                        or len(path.parts) > 32 or any(len(p) > 255 for p in path.parts)
                        or not (member.isfile() or member.isdir()) or member.size < 0):
                    raise ValueError('Unsafe archive entry')
                normalized = str(path)
                if normalized == '.':
                    if not member.isdir():
                        raise ValueError('Invalid root entry')
                    continue
                if normalized in seen:
                    raise ValueError('Duplicate archive entry')
                seen.add(normalized)
                destination = staging.joinpath(*path.parts)
                destination.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                if member.isdir():
                    destination.mkdir(exist_ok=True, mode=0o755)
                    continue
                with tar.extractfile(member) as content:
                    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                                 0o755 if member.mode & 0o111 else 0o644)
                    with os.fdopen(fd, 'wb') as output:
                        remaining = member.size
                        while remaining:
                            chunk = content.read(min(remaining, 64 * 1024))
                            if not chunk:
                                raise ValueError('Truncated archive')
                            if space_check:
                                space_check(len(chunk))
                            output.write(chunk)
                            remaining -= len(chunk)
    marker = staging / 'REVISION'
    if not marker.is_file() or marker.stat().st_size > 41 or marker.read_text().strip() != revision:
        raise ValueError('Revision mismatch')
    if not (staging / 'server.js').is_file() or not (staging / 'SECURITY_VERSION').is_file():
        raise ValueError('Missing release files')


def dump_database(target):
    ensure_space(target.parent, MAX_DUMP)
    process = subprocess.Popen(['runuser', '-u', 'postgres', '--', 'pg_dump', '-Fc', 'my_projects'],
                               stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, start_new_session=True)
    try:
        total = 0
        with open(target, 'xb') as output:
            os.chmod(target, 0o600)
            while True:
                chunk = process.stdout.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_DUMP:
                    raise ValueError('Database dump exceeds size limit')
                ensure_space(target.parent, len(chunk))
                output.write(chunk)
        if process.wait(timeout=30) != 0:
            raise RuntimeError('Database backup failed')
    except BaseException:
        target.unlink(missing_ok=True)
        raise
    finally:
        process.stdout.close()
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()


def health(revision):
    for _ in range(45):
        response = subprocess.run(['curl', '-fsS', '--max-time', '3', 'http://127.0.0.1:4350/api/health'], capture_output=True, timeout=5)
        try:
            value = json.loads(response.stdout)
        except (ValueError, UnicodeError):
            value = {}
        worker = subprocess.run(['runuser', '-u', 'postgres', '--', 'psql', '-d', 'my_projects', '-Atc',
                                 "SELECT value->>'revision' FROM runtime WHERE key='heartbeat' AND (value->>'at')::timestamptz>now()-interval '90 seconds'"],
                                capture_output=True, text=True, timeout=5)
        if response.returncode == 0 and value.get('ok') and value.get('revision') == revision and worker.stdout.strip() == revision:
            return
        time.sleep(1)
    raise RuntimeError('Release health check failed')


def activate(link, release):
    temporary = link.with_name('current.next')
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(release)
    os.replace(temporary, link)


def retain(base, current, previous):
    # Only root-managed SHA release/package names and this project's own dumps.
    releases = sorted((p for p in (base / 'releases').iterdir() if re.fullmatch('[a-f0-9]{40}', p.name) and not p.is_symlink()),
                      key=lambda p: p.stat().st_mtime, reverse=True)
    keep = {current.resolve(), previous.resolve() if previous else current.resolve()}
    keep.update(p.resolve() for p in releases[:5])
    for path in releases:
        if path.resolve() not in keep:
            shutil.rmtree(path)
            (base / 'packages' / (path.name + '.tar.gz')).unlink(missing_ok=True)
    dumps = sorted(pathlib.Path('/var/backups/my-projects').glob('pre-*.dump'), key=lambda p: p.stat().st_mtime, reverse=True)
    for path in dumps[14:]:
        if path.stat().st_mtime < time.time() - 14 * 86400 and not path.is_symlink():
            path.unlink()


def main():
    if os.getuid() != 0 or len(sys.argv) != 3 or not re.fullmatch('[a-f0-9]{40}', sys.argv[1]) or not re.fullmatch('[a-f0-9]{64}', sys.argv[2]):
        raise SystemExit('Expected root, full commit SHA and SHA256 package digest')
    os.umask(0o022)
    resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_CPU, (120, 120))
    resource.setrlimit(resource.RLIMIT_FSIZE, (2 * 1024 ** 3, 2 * 1024 ** 3))
    def timeout(_signum, _frame):
        raise TimeoutError('Deployment deadline exceeded')
    signal.signal(signal.SIGALRM, timeout)
    signal.alarm(480)
    revision, digest = sys.argv[1:]
    with open('/run/lock/my-projects-deploy.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        ensure_space(BASE, MAX_ARCHIVE + MAX_EXPANDED + MAX_DUMP)
        dump_usage = sum(p.stat().st_size for p in pathlib.Path('/var/backups/my-projects').iterdir() if p.is_file())
        if dump_usage + MAX_DUMP > 10 * 1024 ** 3:
            raise ValueError('Backup storage budget reached; review retained recovery backups')
        source = BASE / 'incoming' / (revision + '.tar.gz')
        archive = BASE / 'packages' / (revision + '.tar.gz')
        release = BASE / 'releases' / revision
        backup = pathlib.Path('/var/backups/my-projects') / f'pre-{revision}.dump'
        created_release = False
        had_release = release.exists()
        staging = None
        try:
            if had_release:
                marker = release / '.artifact-sha256'
                if release.is_symlink() or not marker.is_file() or marker.read_text().strip() != digest:
                    raise ValueError('Existing revision has a different artifact')
            copy_archive(source, archive, digest, space_check=lambda size: ensure_space(archive.parent, size))
            if not had_release:
                ensure_space(BASE, MAX_EXPANDED + MAX_DUMP)
                staging = pathlib.Path(tempfile.mkdtemp(prefix='.' + revision + '-', dir=BASE / 'releases'))
                extract_archive(archive, staging, revision, space_check=lambda size: ensure_space(staging, size))
                (staging / '.artifact-sha256').write_text(digest + '\n')
                staging.chmod(0o755)
                os.rename(staging, release)
                created_release = True
            if not backup.exists():
                dump_database(backup)
            run('systemd-run', '--quiet', '--wait', '--pipe', '--collect', '--unit=my-projects-migrate-' + revision[:12],
                '-p', 'User=myprojects-migrator', '-p', 'Group=myprojects-migrator', '-p', 'EnvironmentFile=/etc/my-projects/migrator.env',
                '-p', 'NoNewPrivileges=yes', '-p', 'ProtectSystem=strict', '-p', 'ProtectHome=yes', '-p', 'PrivateTmp=yes',
                '-p', 'CapabilityBoundingSet=', '-p', 'RestrictSUIDSGID=yes', '-p', 'MemoryMax=256M', '-p', 'RuntimeMaxSec=120',
                f'--working-directory={release}', '/opt/node/bin/node', 'scripts/migrate.ts')
        except BaseException:
            if created_release:
                shutil.rmtree(release)
            if not had_release:
                archive.unlink(missing_ok=True)
            # Retain a completed pre-migration dump: a migration may have partially run.
            # Incomplete copies are never usable and must not accumulate.
            if backup.exists() and backup.stat().st_size == 0:
                backup.unlink()
            raise
        finally:
            if staging and staging.exists():
                shutil.rmtree(staging)
        current = BASE / 'current'
        previous = current.resolve() if current.is_symlink() else None
        activate(current, release)
        try:
            run('systemctl', 'stop', 'my-projects', 'my-projects-worker')
            run('systemctl', 'start', 'my-projects', 'my-projects-worker')
            health(revision)
            run('systemctl', 'enable', 'my-projects', 'my-projects-worker')
        except Exception:
            if previous and (previous / 'SECURITY_VERSION').is_file():
                activate(current, previous)
                run('systemctl', 'stop', 'my-projects', 'my-projects-worker')
                run('systemctl', 'start', 'my-projects', 'my-projects-worker')
            else:
                # Old code cannot safely consume new session semantics. Fail closed.
                run('systemctl', 'stop', 'my-projects', 'my-projects-worker')
            raise
        retain(BASE, release, previous)
        source.unlink(missing_ok=True)
        print('Deployed ' + revision)


if __name__ == '__main__':
    main()
