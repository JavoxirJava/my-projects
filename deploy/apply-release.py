#!/usr/bin/env python3
"""Reviewed root dispatcher: incoming application code executes only as service UIDs."""
import fcntl,json,os,pathlib,re,shutil,subprocess,sys,tarfile,time

def run(*args,**kwargs):return subprocess.run(args,check=True,**kwargs)
if os.getuid()!=0 or len(sys.argv)!=2 or not re.fullmatch(r'[a-f0-9]{40}',sys.argv[1]):raise SystemExit('Expected root and full commit SHA')
revision=sys.argv[1];base=pathlib.Path('/srv/my-projects');release=base/'releases'/revision
lock=open('/run/lock/my-projects-deploy.lock','w');fcntl.flock(lock,fcntl.LOCK_EX)
source=base/'incoming'/f'{revision}.tar.gz';archive=base/'packages'/f'{revision}.tar.gz'
fd=os.open(source,os.O_RDONLY|os.O_NOFOLLOW)
with os.fdopen(fd,'rb') as src,open(archive,'wb') as dst:shutil.copyfileobj(src,dst)
os.chmod(archive,0o640);shutil.chown(archive,user='root',group='myprojects')
with tarfile.open(archive,'r:gz') as tar:
 members=tar.getmembers()
 if len(members)>100000 or sum(m.size for m in members)>1500000000:raise SystemExit('Archive too large')
 for member in members:
  path=pathlib.PurePosixPath(member.name)
  if path.is_absolute() or '..' in path.parts or not (member.isfile() or member.isdir()):raise SystemExit(f'Unsafe archive entry {member.name}')
 rev=next((m for m in members if m.name.lstrip('./')=='REVISION'),None)
 if not rev or tar.extractfile(rev).read().decode().strip()!=revision:raise SystemExit('Revision mismatch')
if not release.exists():
 staging=base/'releases'/f'.{revision}.{os.getpid()}'
 run('install','-d','-m','755','-o','myprojects','-g','myprojects',str(staging))
 run('runuser','-u','myprojects','--','tar','xzf',str(archive),'-C',str(staging),'--no-same-owner','--no-same-permissions')
 run('chown','-R','root:root',str(staging));run('chmod','-R','u=rwX,go=rX',str(staging))
 os.rename(staging,release)
if (release/'REVISION').read_text().strip()!=revision:raise SystemExit('Installed release revision mismatch')
backup=f'/var/backups/my-projects/pre-{revision}-{int(time.time())}.dump'
with open(backup,'wb') as file:run('runuser','-u','postgres','--','pg_dump','-Fc','my_projects',stdout=file)
os.chmod(backup,0o600)
run('systemd-run','--quiet','--wait','--pipe','--collect','--unit=my-projects-migrate-'+revision[:12],'-p','User=myprojects-migrator','-p','Group=myprojects-migrator','-p','EnvironmentFile=/etc/my-projects/migrator.env','-p','NoNewPrivileges=yes','-p','ProtectSystem=strict','-p','ProtectHome=yes','-p','PrivateTmp=yes','-p','CapabilityBoundingSet=','-p','RestrictSUIDSGID=yes','-p','MemoryMax=256M','-p','RuntimeMaxSec=120',f'--working-directory={release}','/opt/node/bin/node','scripts/migrate.ts')
current=base/'current';previous=os.readlink(current) if current.is_symlink() else None
nextpath=base/'current.next';nextpath.unlink(missing_ok=True);nextpath.symlink_to(release);os.replace(nextpath,current)
try:
 if subprocess.run(['systemctl','is-active','--quiet','my-projects']).returncode==0:run('systemctl','reload','my-projects')
 else:run('systemctl','start','my-projects')
 for attempt in range(45):
  check=subprocess.run(['curl','-fsS','--max-time','3','http://127.0.0.1:4350/api/health'],capture_output=True)
  try: health=json.loads(check.stdout)
  except Exception:health={}
  worker=subprocess.run(['runuser','-u','postgres','--','psql','-d','my_projects','-Atc',"SELECT value->>'revision' FROM runtime WHERE key='heartbeat'"],capture_output=True,text=True)
  if check.returncode==0 and health.get('ok') and health.get('revision')==revision and worker.stdout.strip()==revision:break
  time.sleep(1)
 else:raise RuntimeError('Release health check failed')
 run('systemctl','enable','my-projects')
except Exception:
 if previous:
  nextpath.symlink_to(previous);os.replace(nextpath,current);run('systemctl','reload','my-projects')
 else:run('systemctl','stop','my-projects')
 raise
print('Deployed '+revision)
