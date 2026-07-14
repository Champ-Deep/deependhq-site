#!/bin/bash
# deependhq.com local dev : double-click me.
# Runs on port 4321 (3000 is taken by Open WebUI on this Mac).
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo ">_ first run: installing dependencies (one-time, a few minutes)"
  npm install
fi
( sleep 4 && open "http://localhost:4321" ) &
npm run dev -- -p 4321
