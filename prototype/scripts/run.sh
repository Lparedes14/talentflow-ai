#!/usr/bin/env bash
#
# Run any pipeline script and keep the whole session in a log file.
#
#   ./scripts/run.sh 09_compare_extractors.py --limit 20
#   ./scripts/run.sh 13_eval_fairness.py --audit-only
#   ./scripts/run.sh 12_list_models.py
#
# The script name can be given with or without the number, extension or path:
# `09`, `09_compare`, `09_compare_extractors.py` and `scripts/09_compare_extractors.py`
# all resolve, so there is nothing to remember or mistype.
#
# Output goes to the terminal AND to data/runs/<timestamp>-<script>.log, with
# data/runs/latest.log always pointing at the most recent one. Both stdout and stderr are
# captured, in order, so a traceback lands in the file next to the log lines that preceded
# it. That is the whole point: a truncated paste loses exactly the context that explains
# the failure.
#
# Keys are redacted from the log before it is written. Logs are not secret by intent, but
# a log is a file that gets copied around, and .env values can end up in a traceback.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNS="$ROOT/data/runs"
mkdir -p "$RUNS"

if [ $# -eq 0 ]; then
  echo "usage: ./scripts/run.sh <script> [args...]" >&2
  echo >&2
  echo "available:" >&2
  ls "$ROOT/scripts" | grep -E '^[0-9]+_.*\.py$' | sed 's/^/  /' >&2
  exit 2
fi

WANTED="$1"; shift
BASE="$(basename "$WANTED" .py)"

MATCHES=$(ls "$ROOT/scripts" | grep -E '^[0-9]+_.*\.py$' | grep -i -- "$BASE" || true)
COUNT=$(printf '%s' "$MATCHES" | grep -c . || true)

if [ "$COUNT" -eq 0 ]; then
  echo "no script matches '$WANTED'. available:" >&2
  ls "$ROOT/scripts" | grep -E '^[0-9]+_.*\.py$' | sed 's/^/  /' >&2
  exit 2
elif [ "$COUNT" -gt 1 ]; then
  echo "'$WANTED' matches more than one script, be more specific:" >&2
  printf '%s\n' "$MATCHES" | sed 's/^/  /' >&2
  exit 2
fi

SCRIPT_NAME="$MATCHES"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOG="$RUNS/${STAMP}-${SCRIPT_NAME%.py}.log"

{
  echo "# $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "# command : python scripts/$SCRIPT_NAME $*"
  echo "# python  : $(python --version 2>&1)"
  echo "# venv    : ${VIRTUAL_ENV:-none active}"
  echo "# ---------------------------------------------------------------------"
} > "$LOG"

# unbuffered, so a run that is killed still leaves everything it printed
( cd "$ROOT" && python -u "scripts/$SCRIPT_NAME" "$@" ) 2>&1 | tee -a "$LOG"
STATUS=${PIPESTATUS[0]}

{
  echo "# ---------------------------------------------------------------------"
  echo "# exit status: $STATUS"
} >> "$LOG"

# Redact anything key-shaped before this file goes anywhere. Same patterns package.sh uses.
if command -v perl >/dev/null 2>&1; then
  perl -i -pe 's/(sk-ant-api[\w-]{8})[\w-]+/$1<redacted>/g;
               s/(sk-proj-[\w-]{8})[\w-]+/$1<redacted>/g;
               s/(AIzaSy[\w-]{4})[\w-]+/$1<redacted>/g;
               s/(ghp_[\w]{4})[\w]+/$1<redacted>/g;' "$LOG"
fi

cp "$LOG" "$RUNS/latest.log"

echo
echo "log: data/runs/$(basename "$LOG")   (also data/runs/latest.log)"
exit "$STATUS"
