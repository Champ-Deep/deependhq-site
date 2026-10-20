"""Stage an immutable local Worker preview outside the watched checkout.
Run wrangler deploy --dry-run into toolkit-worker-bundle first. No deployment.
"""
import fnmatch,json,pathlib,shutil,subprocess
ROOT=pathlib.Path(__file__).resolve().parent.parent
OUT=pathlib.Path.home()/'.hermes/cache/scratch/toolkit-preview'
BUNDLE=pathlib.Path.home()/'.hermes/cache/scratch/toolkit-worker-bundle/index.js'
assert BUNDLE.is_file(), 'Run the documented Worker dry-run first'
assert not OUT.exists(), 'Use a fresh output directory, not a running preview'
patterns=[s.strip() for s in (ROOT/'.assetsignore').read_text().splitlines() if s.strip() and not s.startswith('#')]
files=subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=ROOT).decode().split('\0')
count=0
for name in files:
    if not name or name.startswith('.') or any(fnmatch.fnmatch(name,p) or (p.endswith('/') and name.startswith(p)) for p in patterns): continue
    source=ROOT/name
    if not source.is_file() or source.is_symlink(): continue
    dest=OUT/'public'/name
    dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(source,dest);count+=1
shutil.copy2(BUNDLE,OUT/'worker.js')
(OUT/'migrations').mkdir()
shutil.copy2(ROOT/'migrations/0001_toolkit.sql',OUT/'migrations/0001_toolkit.sql')
config={
  'name':'toolkit-preview-local-only','main':'worker.js','compatibility_date':'2026-05-23','compatibility_flags':['nodejs_compat'],
  'assets':{'directory':'./public','binding':'ASSETS','not_found_handling':'404-page','run_worker_first':['/','/api/*','/lead-scorer','/account','/toolkit']},
  'd1_databases':[{'database_name':'toolkit-local','database_id':'local-toolkit-only','binding':'TOOLKIT_DB','migrations_dir':'migrations'}]
}
(OUT/'wrangler.jsonc').write_text(json.dumps(config,indent=2)+'\n')
print('Local preview staged:',OUT,'public files:',count)
