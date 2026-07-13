#!/bin/bash
# deependhq.com local dev : double-click me.
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo ">_ first run: installing dependencies (one-time, a few minutes)"
  npm install
fi
( sleep 4 && open "http://localhost:3000" ) &
npm run dev
