"""Run the combined release gates, retaining each real exit status."""
import json
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
out = root / 'docs/verification/release'
out.mkdir(parents=True, exist_ok=True)
commands = [
    'NODE_ENV=production npm run build', 'npm test', 'npm run check', 'npm run brand-guard', 'npm run contrast',
    *['node scripts/selftest-' + name + '.mjs' for name in ['worker', 'segment', 'copy', 'digest', 'privacy']],
    'node --test scripts/lead-scorer.test.mjs scripts/toolkit-catalog.test.mjs scripts/toolkit-routing.test.mjs scripts/toolkit-session.test.mjs scripts/toolkit-integration.test.mjs tests/toolkit-lib.test.js',
    *['node scripts/toolkit-' + name + '-selftest.mjs' for name in ['store', 'api', 'billing']],
    'bash -n scripts/publish.sh scripts/publish-native.sh',
]
results = []
for i, command in enumerate(commands):
    run = subprocess.run(command, shell=True, cwd=root, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    log = f'gate-{i:02d}.txt'
    (out / log).write_text(run.stdout)
    results.append({'command': command, 'exit': run.returncode, 'log': log})
    print(command, 'EXIT', run.returncode, flush=True)
(out / 'gates.json').write_text(json.dumps(results, indent=2) + '\n')
assert len(results) == len(commands)
assert all(row['exit'] == 0 for row in results), 'One or more required gates failed'
