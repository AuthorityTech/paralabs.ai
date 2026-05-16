#!/usr/bin/env bash
# Smoke-check: verify that every required secret / credential is available.
# Exits non-zero on the first missing item so CI or agent startup fails fast.

set -euo pipefail

fail=0

check_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "FAIL  $name is not set." >&2
    fail=1
  else
    echo "  OK  $name is set."
  fi
}

check_file() {
  local name="$1"
  local path="${!name:-}"
  if [ -z "$path" ]; then
    echo "FAIL  $name is not set." >&2
    fail=1
  elif [ ! -f "$path" ]; then
    echo "FAIL  $name=$path — file does not exist." >&2
    fail=1
  else
    echo "  OK  $name=$path exists."
  fi
}

echo "── Auth smoke check ──────────────────────────────"

check_file GOOGLE_APPLICATION_CREDENTIALS
check_env  VERCEL_TOKEN
check_env  VERCEL_ORG_ID
check_env  VERCEL_PROJECT_ID

echo "──────────────────────────────────────────────────"

if [ "$fail" -ne 0 ]; then
  echo "Smoke check FAILED — see above." >&2
  exit 1
fi

echo "All checks passed."