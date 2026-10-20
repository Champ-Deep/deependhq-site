"""Stage the exact public asset set and a binding-free isolated Worker."""
import fnmatch
import json
import pathlib
import shutil
import subprocess
root = pathlib.Path(__file__).resolve().parents[1]
out = root / '.release'
public = out / 'public'
if public.exists():
    shutil.rmtree(public)
public.mkdir(parents=True, exist_ok=True)
patterns = [line.strip() for line in (root / '.assetsignore').read_text().splitlines() if line.strip() and not line.startswith('#')]
files = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=root).decode().split('\0')
manifest = []
for name in sorted(set(files)):
    if not name or any(part.startswith('.') for part in pathlib.Path(name).parts):
        continue
    if any(fnmatch.fnmatch(name, p) or (p.endswith('/') and name.startswith(p)) for p in patterns):
        continue
    source = root / name
    if not source.is_file() or source.is_symlink():
        continue
    assert not name.startswith(('docs/', 'tests/', 'scripts/', 'worker/', 'islands/', 'node_modules/'))
    assert not name.endswith(('.db', '.sqlite', '.log', '.md'))
    dest = public / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, dest)
    manifest.append(name)
assert 'home-islands.js' in manifest and 'scheme.js' in manifest
(root / 'docs/verification/release/assets.json').write_text(json.dumps(manifest, indent=2) + '\n')
config = {'name': 'deependhq-refresh-v2-preview-20261021', 'main': str(root / 'worker/index.js'), 'compatibility_date': '2026-05-23', 'compatibility_flags': ['nodejs_compat'], 'workers_dev': True, 'routes': [], 'assets': {'directory': str(public), 'binding': 'ASSETS', 'not_found_handling': '404-page', 'run_worker_first': ['/*']}}
(out / 'wrangler.jsonc').write_text(json.dumps(config, indent=2) + '\n')
print(f'Staged {len(manifest)} public assets; preview has no routes, D1, secrets or production bindings.')
