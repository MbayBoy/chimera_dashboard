#!/usr/bin/env bash
# The one command referenced in the README: from a clean checkout to a running,
# migrated, seeded API.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { cp .env.example .env; echo "created .env from .env.example — fill in the secrets"; }

pnpm install
pnpm --filter @ninety/api db:migrate
pnpm --filter @ninety/api db:seed
echo
echo "Ready. Start the API with:  pnpm dev"
