#!/usr/bin/env bash
# Phase 00, criterion (h): delete one Arabic key, watch the build fail, restore it.
#
# Arabic is a launch requirement in market #1, not a later addition. A key that
# exists in English and is missing in Arabic would otherwise reach a Sharjah yard
# as English text on a screen they are expected to answer in ninety seconds.
set -uo pipefail
cd "$(dirname "$0")/.."

CATALOGUE=apps/api/src/i18n/catalogues/ar.json
BACKUP=$(mktemp)
cp "$CATALOGUE" "$BACKUP"
cleanup() { cp "$BACKUP" "$CATALOGUE"; rm -f "$BACKUP"; }
trap cleanup EXIT

echo "1. Parity check on the complete catalogues"
pnpm --filter @ninety/config test 2>&1 | tail -5
CLEAN=${PIPESTATUS[0]}

echo
echo "2. Deleting notify.supplier.offer_accepted from the Arabic catalogue"
python3 - "$CATALOGUE" <<'PY'
import json, sys
p = sys.argv[1]
d = json.load(open(p))
del d['notify']['supplier']['offer_accepted']
json.dump(d, open(p, 'w'), ensure_ascii=False, indent=2)
PY

echo
echo "3. Parity check — this MUST fail"
pnpm --filter @ninety/config test 2>&1 | grep -E "out of parity|missing [0-9]|Tests " | head -8
POISONED=${PIPESTATUS[0]}

cleanup
trap - EXIT

echo
echo "4. Restored — parity check passes again"
pnpm --filter @ninety/config test 2>&1 | tail -5
REVERTED=${PIPESTATUS[0]}

echo
if [ "$CLEAN" -eq 0 ] && [ "$POISONED" -ne 0 ] && [ "$REVERTED" -eq 0 ]; then
  echo "GATE (h) PASS — complete: pass, missing Arabic key: FAIL, restored: pass"
  exit 0
fi
echo "GATE (h) NOT DEMONSTRATED — clean=$CLEAN poisoned=$POISONED reverted=$REVERTED"
exit 1
