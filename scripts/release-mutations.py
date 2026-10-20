"""Prove the redirect and frozen-copy gates reject the defects they guard."""
from pathlib import Path
import json
import subprocess
root = Path(__file__).resolve().parents[1]
out = root / 'docs/verification/release'
cases = [
    ('worker/index.js', "'/command': { to: '/journey#commits', code: 301 }", "'/command': { to: '/journey#broken', code: 301 }", 'node scripts/selftest-worker.mjs'),
    ('worker/index.js', "'/command.html': { to: '/journey#commits', code: 301 }", "'/command.html': { to: '/journey#commits', code: 302 }", 'node scripts/selftest-worker.mjs'),
    ('index.html', 'data-day="354" data-dh-frozen=""', 'data-day="354"', 'node scripts/selftest-copy.mjs'),
    ('index.html', 'class="wx-metric-row" data-dh-frozen=""', 'class="wx-metric-row"', 'node scripts/selftest-copy.mjs'),
]
results = []
for i, (name, old, new, command) in enumerate(cases):
    path = root / name
    original = path.read_text()
    assert original.count(old) == 1, (name, old)
    try:
        path.write_text(original.replace(old, new))
        run = subprocess.run(command, shell=True, cwd=root, text=True, capture_output=True)
        (out / f'mutation-{i}.txt').write_text(run.stdout + run.stderr)
        assert run.returncode != 0, f'Gate missed mutation {i}'
        results.append({'defect': new, 'command': command, 'exit': run.returncode})
    finally:
        path.write_text(original)
for command in sorted({c[3] for c in cases}):
    run = subprocess.run(command, shell=True, cwd=root, text=True, capture_output=True)
    assert run.returncode == 0, run.stdout + run.stderr
(out / 'mutations.json').write_text(json.dumps(results, indent=2) + '\n')
print(f'{len(results)} mutations rejected; both restored gates green.')
