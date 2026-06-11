#!/usr/bin/env bash
# install-native-publisher.sh : one-time installer for the Mac-side fallback
# publisher. Run ONCE in Terminal on the Mac:
#
#   bash "/Users/deep/Celsus/Efforts/Active/TheDeepEndHQ/deependhq-site/scripts/install-native-publisher.sh"
#
# Installs a LaunchAgent that runs publish-native.sh daily at 02:15 IST
# (after the 01:39 IST Claude authoring run). If the Mac is asleep at 02:15,
# launchd runs it on next wake. Logs: /tmp/deependhq-publish.log
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.champ.deependhq-publish"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$REPO_DIR/scripts/publish-native.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>2</integer>
    <key>Minute</key><integer>15</integer>
  </dict>
  <key>StandardOutPath</key><string>/tmp/deependhq-publish.log</string>
  <key>StandardErrorPath</key><string>/tmp/deependhq-publish.log</string>
</dict>
</plist>
PLIST_EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Installed and loaded $LABEL."
echo "It will run daily at 02:15 (on next wake if the Mac is asleep)."
echo "Test it now with:  bash \"$REPO_DIR/scripts/publish-native.sh\""
