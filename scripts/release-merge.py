"""Record dry-run conflict sets and verify the real merge matches."""
import json
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[1]
branch, step = sys.argv[1:]
out = root / 'docs/verification/release'
out.mkdir(parents=True, exist_ok=True)
def git(*args):
    return subprocess.run(['git', *args], cwd=root, text=True, capture_output=True)
assert not git('status', '--porcelain', '--untracked-files=no').stdout, 'Tracked tree must be clean'
head = git('rev-parse', branch).stdout.strip()
dry = git('merge-tree', '--write-tree', 'HEAD', head)
(out / f'merge-{step}-dry.txt').write_text(dry.stdout + dry.stderr)
expected = sorted({line.split('\t')[1] for line in dry.stdout.splitlines() if '\t' in line and line.split('\t')[0].endswith((' 1', ' 2', ' 3'))})
actual = git('merge', '--no-ff', '--no-commit', head)
(out / f'merge-{step}-actual.txt').write_text(actual.stdout + actual.stderr)
observed = sorted(git('diff', '--name-only', '--diff-filter=U').stdout.splitlines())
assert observed == expected, (expected, observed)
(out / f'merge-{step}.json').write_text(json.dumps({'branch': branch, 'head': head, 'conflicts': observed}, indent=2))
print(json.dumps({'head': head, 'conflicts': observed}, indent=2))
