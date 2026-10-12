#!/usr/bin/env bash
# Runs each time you open the codespace: start backend + frontend unless already running.
cd "$(dirname "$0")/.."
if curl -s -o /dev/null http://127.0.0.1:5173; then
  echo "Dev server already running → open the PORTS tab, port 5173 (Website)."
  exit 0
fi
echo "Starting backend + frontend… open the PORTS tab, port 5173 (Website), when ready."
exec npm run dev
