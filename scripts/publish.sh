#!/usr/bin/env bash
# publish.sh : generic worktree-to-GitHub publisher over SSH with a deploy key.
#
# WHY THIS EXISTS
# The working clone lives inside the Obsidian vault. Sandboxed agent sessions
# can edit the worktree but CANNOT use its .git (no usable git state, cannot
# delete .git/index.lock). This script sidesteps the local .git entirely:
#   fresh shallow clone (SSH + repo-scoped deploy key) -> rsync worktree over
#   it -> commit -> push. Cloudflare Pages then auto-deploys from the branch.
#
# AUTH MODEL (standing preference: SSH, not PATs)
# One ed25519 DEPLOY KEY per repo, added in GitHub under
# repo -> Settings -> Deploy keys, with "Allow write access" checked.
# A deploy key can touch ONLY its repo. Keys + pinned GitHub host keys live in
# the vault at Other/.secrets/ (dotfolder, invisible to Obsidian, never in a repo).
#
# REUSABLE TEMPLATE
# Works for any static microsite. Override via env vars:
#   PUBLISH_REPO         owner/repo               (default Champ-Deep/deependhq-site)
#   PUBLISH_BRANCH       branch CF deploys        (default main — Workers Builds production branch)
#   PUBLISH_SRC          worktree dir             (default: parent of this script)
#   PUBLISH_KEY_FILE     private deploy key       (default: <vault>/Other/.secrets/deploy_key_<repo-name>)
#   PUBLISH_KNOWN_HOSTS  pinned host keys         (default: <vault>/Other/.secrets/github_known_hosts)
#   PUBLISH_MSG          commit message           (default: "site: publish <date>")
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="${PUBLISH_SRC:-$(dirname "$SCRIPT_DIR")}"
REPO="${PUBLISH_REPO:-Champ-Deep/deependhq-site}"
BRANCH="${PUBLISH_BRANCH:-main}"
REPO_NAME="${REPO##*/}"
MSG="${PUBLISH_MSG:-site: publish $(date +%F)}"

# Vault root = 4 levels up from the repo (Celsus/Efforts/Active/TheDeepEndHQ/<repo>).
VAULT_ROOT="$(cd "$SRC_DIR/../../../.." && pwd)"
KEY_FILE="${PUBLISH_KEY_FILE:-$VAULT_ROOT/Other/.secrets/deploy_key_$REPO_NAME}"
KNOWN_HOSTS="${PUBLISH_KNOWN_HOSTS:-$VAULT_ROOT/Other/.secrets/github_known_hosts}"

if [[ ! -f "$KEY_FILE" ]]; then
  echo "PUBLISH-FAILED: deploy key not found at $KEY_FILE" >&2
  echo "Generate one (ssh-keygen -t ed25519 -N '' -f <file>) and add the .pub as a" >&2
  echo "write-access deploy key on github.com/$REPO -> Settings -> Deploy keys." >&2
  exit 2
fi
if [[ ! -f "$KNOWN_HOSTS" ]]; then
  ssh-keyscan -t ed25519,rsa github.com 2>/dev/null > "$KNOWN_HOSTS" \
    || { echo "PUBLISH-FAILED: cannot pin github.com host keys (no network?)" >&2; exit 2; }
fi
chmod 600 "$KEY_FILE" 2>/dev/null || true

export GIT_SSH_COMMAND="ssh -i '$KEY_FILE' -o IdentitiesOnly=yes -o UserKnownHostsFile='$KNOWN_HOSTS' -o StrictHostKeyChecking=yes -o BatchMode=yes"

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "cloning $REPO@$BRANCH (shallow, ssh) ..."
if ! git clone --quiet --depth 1 --branch "$BRANCH" \
    "git@github.com:${REPO}.git" "$TMP/repo" 2>"$TMP/clone.err"; then
  echo "PUBLISH-FAILED: clone failed. Likely the deploy key is not added (or lacks" >&2
  echo "write access) on github.com/$REPO -> Settings -> Deploy keys. Raw error:" >&2
  cat "$TMP/clone.err" >&2
  exit 3
fi

# Mirror the worktree onto the clone. .gitignore in the repo keeps scratch out.
# The worktree now contains node_modules (esbuild, playwright-core, wrangler) and
# build scratch. rsync --delete mirrors it, so without these excludes the repo
# gains hundreds of MB of dependencies every night and the deploy slows to a
# crawl. Verified 2026-09-26: the excludes below are load-bearing.
rsync -a --delete \
  --exclude '.git' \
  --exclude '.DS_Store' \
  --exclude 'node_modules' \
  --exclude 'deependhq-next/node_modules' \
  --exclude '**/.next' \
  --exclude 'scripts/.entry-*' \
  --exclude 'scripts/pending-entry.json' \
  --exclude 'scripts/.prerender-cache' \
  --exclude 'scripts/.shots' \
  --exclude '.wrangler' \
  "$SRC_DIR"/ "$TMP/repo"/

cd "$TMP/repo"

# The gates run against the MIRRORED tree, not the worktree, so what is checked
# is exactly what is about to be pushed. A failure here stops the publish.
if [ "${PUBLISH_SKIP_GATES:-0}" != "1" ]; then
  echo "gates: guard + build + prerender ..."
  node scripts/guard.mjs || { echo "PUBLISH-FAILED: the naming or disclosure guard refused." >&2; exit 5; }
  node scripts/build-data.mjs || { echo "PUBLISH-FAILED: build-data refused." >&2; exit 5; }
  # esbuild is a devDependency, and node_modules is excluded from the mirror on
  # purpose. So the gate looks for it in the SOURCE tree, not the clone, and
  # passes ESBUILD_BIN so prerender.mjs uses that binary instead of resolving
  # ./node_modules. On a machine with no npm install at all the gate says so out
  # loud rather than silently shipping pages with an empty #root.
  SRC_ESBUILD="$SRC_DIR/node_modules/.bin/esbuild"
  if [ -x "$SRC_ESBUILD" ]; then
    ESBUILD_BIN="$SRC_ESBUILD" node scripts/prerender.mjs || { echo "PUBLISH-FAILED: prerender refused." >&2; exit 5; }
  elif command -v esbuild >/dev/null 2>&1; then
    node scripts/prerender.mjs || { echo "PUBLISH-FAILED: prerender refused." >&2; exit 5; }
  else
    echo "PUBLISH-FAILED: esbuild is not installed, so prerender cannot run." >&2
    echo "  The pages would publish with an empty #root and no text for a crawler." >&2
    echo "  Fix: cd $SRC_DIR && npm install   (or: PUBLISH_SKIP_GATES=1 to override)" >&2
    exit 6
  fi

  # Runs on the PRERENDERED html, which is what a visitor receives. A link to a
  # page that does not exist is a 404 in production, and on 2026-09-26 two
  # publishes shipped one before anything noticed. This is the last gate.
  node scripts/link-check.mjs || { echo "PUBLISH-FAILED: a link points at a page that does not exist." >&2; exit 7; }
  git add -A
  if git diff --cached --quiet; then
    echo "NOTHING-TO-PUBLISH: gates ran clean and the remote already matches."
    exit 0
  fi
fi

git add -A
if git diff --cached --quiet; then
  echo "NOTHING-TO-PUBLISH: remote already matches the worktree."
  exit 0
fi

git -c user.name="Champ Publisher" -c user.email="deep@championsmail.com" \
  commit --quiet -m "$MSG"
if ! git push --quiet origin "$BRANCH" 2>"$TMP/push.err"; then
  echo "PUBLISH-FAILED: push rejected (deploy key likely read-only):" >&2
  cat "$TMP/push.err" >&2
  exit 4
fi

SHA="$(git rev-parse --short HEAD)"
echo "PUBLISHED: $REPO@$BRANCH $SHA ($MSG)"
echo "Cloudflare Pages will redeploy automatically (~1 min)."
