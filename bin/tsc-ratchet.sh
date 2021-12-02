#!/bin/bash

set -e

mkdir -p tmp

set +e
npx tsc --noEmit > tmp/tsc.log
set -e

# PROBLEMS=$(grep ': error TS' tmp/tsc.log | wc -l | awk '{ print $1 }')
PROBLEMS=$(grep -c ': error TS' tmp/tsc.log)

[ -z "$PROBLEMS" ] && exit 0

RATCHET=$(cat .tsc-ratchet)

if [ "$PROBLEMS" -gt "$RATCHET" ]; then
  echo "tsc errors increased from ${RATCHET} to ${PROBLEMS}." >&2
  exit 1
fi

if [ "$PROBLEMS" -lt "$RATCHET" ]; then
  if [ "$CI" = "true" ]; then
    echo "tsc errors decreased from ${RATCHET} to ${PROBLEMS}, but .tsc-ratchet was not updated." >&2
    exit 1
  else
    echo "tsc errors decreased from ${RATCHET} to ${PROBLEMS}. Ratcheting down."
    echo "$PROBLEMS" > .tsc-ratchet
  fi
fi
