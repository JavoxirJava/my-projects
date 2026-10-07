#!/usr/bin/env python3
"""Root-only, new-project provisioning. Never edits existing project config."""
import os,pathlib,secrets,subprocess,json

def run(*args,**kwargs): return subprocess.run(args,check=True,**kwargs)
def user(name,home,shell='/usr/sbin/nologin'):
 if subprocess.run(['id',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:run('useradd','--system','--create-home','--home-dir',home,'--shell',shell,name)
user('myprojects','/var/lib/my-projects')
user('myprojects-migrator','/var/lib/my-projects-migrator')
user('myprojects-deploy','/var/lib/my-projects-deploy','/bin/bash')
for path,owner,mode in [('/srv/my-projects','root:root','755'),('/srv/my-projects/incoming','myprojects-deploy:myprojects-deploy','700'),('/srv/my-projects/releases','root:root','755'),('/srv/my-projects/packages','root:myprojects','750'),('/etc/my-projects','root:myprojects','750'),('/var/backups/my-projects','root:root','700')]:
 run('install','-d','-m',mode,'-o',owner.split(':')[0],'-g',owner.split(':')[1],path)
p=pathlib.Path('/etc/my-projects/database.json')
if p.exists():raise SystemExit('Already provisioned; refusing credential rotation')
app=secrets.token_hex(28);migrator=secrets.token_hex(28)
sql=f"""CREATE ROLE myprojects_app LOGIN PASSWORD '{app}' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 12;
CREATE ROLE myprojects_migrator LOGIN PASSWORD '{migrator}' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 3;
CREATE DATABASE my_projects OWNER myprojects_migrator;
REVOKE ALL ON DATABASE my_projects FROM PUBLIC;
GRANT CONNECT ON DATABASE my_projects TO myprojects_app;
"""
run('runuser','-u','postgres','--','psql','-v','ON_ERROR_STOP=1',input=sql,text=True,stdout=subprocess.DEVNULL)
sql="""REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO myprojects_app;
ALTER DEFAULT PRIVILEGES FOR ROLE myprojects_migrator IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO myprojects_app;
ALTER DEFAULT PRIVILEGES FOR ROLE myprojects_migrator IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO myprojects_app;
"""
run('runuser','-u','postgres','--','psql','-d','my_projects','-v','ON_ERROR_STOP=1',input=sql,text=True,stdout=subprocess.DEVNULL)
os.umask(0o077)
p.write_text(json.dumps({'DATABASE_URL':f'postgresql://myprojects_app:{app}@127.0.0.1:5432/my_projects','MIGRATION_DATABASE_URL':f'postgresql://myprojects_migrator:{migrator}@127.0.0.1:5432/my_projects'}))
print('Isolated users and database provisioned')
