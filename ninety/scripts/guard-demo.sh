#!/usr/bin/env bash
# Phase 00, criterion (f): watch the guard actually bite.
#
# Introduces one market-specific literal into application code, runs the guard,
# shows it fail the build, then reverts. A guard nobody has seen fail is a guard
# nobody trusts — and this one exists precisely because nobody catches a stray
# currency code by reading a diff.
set -uo pipefail
cd "$(dirname "$0")/.."

VICTIM=apps/api/src/market/config.ts
BACKUP=$(mktemp)
cp "$VICTIM" "$BACKUP"
cleanup() { cp "$BACKUP" "$VICTIM"; rm -f "$BACKUP"; }
trap cleanup EXIT

echo "───────────────────────────────────────────────────────────────"
echo "1. Guard on the clean tree"
echo "───────────────────────────────────────────────────────────────"
pnpm --filter @ninety/config test 2>&1 | tail -6
CLEAN=${PIPESTATUS[0]}

echo
echo "───────────────────────────────────────────────────────────────"
echo "2. Introducing a deliberate violation into $VICTIM"
echo "───────────────────────────────────────────────────────────────"
cat >> "$VICTIM" <<'VIOLATION'

// Deliberate violation for the Phase 00 gate. The guard must reject this.
export const OOPS_HARDCODED_CURRENCY = 'AED';
export const OOPS_HARDCODED_TAX_RATE = 0.05;
export const OOPS_HARDCODED_SLA_SECONDS = 15 * 60;
VIOLATION
tail -5 "$VICTIM"

echo
echo "───────────────────────────────────────────────────────────────"
echo "3. Guard on the poisoned tree — this MUST fail"
echo "───────────────────────────────────────────────────────────────"
pnpm --filter @ninety/config test 2>&1 | grep -E "config\.ts:[0-9]+|market-specific literal|Tests " | head -12
POISONED=${PIPESTATUS[0]}

cleanup
trap - EXIT

echo
echo "───────────────────────────────────────────────────────────────"
echo "4. Reverted — guard passes again"
echo "───────────────────────────────────────────────────────────────"
pnpm --filter @ninety/config test 2>&1 | tail -5
REVERTED=${PIPESTATUS[0]}

echo
if [ "$CLEAN" -eq 0 ] && [ "$POISONED" -ne 0 ] && [ "$REVERTED" -eq 0 ]; then
  echo "GATE (f) PASS — clean: pass, violation: FAIL, reverted: pass"
  exit 0
fi
echo "GATE (f) NOT DEMONSTRATED — clean=$CLEAN poisoned=$POISONED reverted=$REVERTED"
exit 1
