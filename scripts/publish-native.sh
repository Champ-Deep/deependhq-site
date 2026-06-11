#!/usr/bin/env bash
# publish-native.sh : fallback publisher that runs ON THE MAC (not in a sandbox).
# Uses the local clone's own .git and Sreedeep's existing SSH key. Clears the
# stale index.lock that sandboxed sessions cannot delete, commits everything
# the nightly authoring task changed, and pushes. Safe to run repeatedly:
# exits quietly when there is nothing to publish.
#
# Installed as a LaunchAgent by install-native-publisher.sh (daily 02:15 IST).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${PUBLISH_BRANCH:-main}"
LOG_PREFIX="[deependhq-native-publish $(date '+%F %T')]"

cd "$REPO_DIR"

# Clear a stale lock only if no git process is actually running.
if [[ -f .git/index.lock ]] && ! pgrep -f "git.*$(basename "$REPO_DIR")" >/dev/null 2>&1; then
  rm -f .git/index.lock
  echo "$LOG_PREFIX removed stale .git/index.lock"
fi

git add -A
if git diff --cached --quiet; then
  echo "$LOG_PREFIX nothing to publish."
  exit 0
fi

git commit -m "site: native publish $(date +%F)"
# Push whatever branch is checked out onto the production branch.
git push origin "HEAD:$BRANCH"
echo "$LOG_PREFIX pushed $(git rev-parse --short HEAD) to $BRANCH. Cloudflare Pages will redeploy."
