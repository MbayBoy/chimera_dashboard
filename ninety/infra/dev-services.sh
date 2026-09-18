#!/usr/bin/env bash
# Bring up PostgreSQL 16 + PostGIS and Redis without Docker.
#
# The supported path is infra/docker-compose.yml. This script exists for
# environments where a Docker daemon is not available (CI sandboxes, some remote
# dev containers) and does exactly what the compose file does: a PostGIS-enabled
# database and a Redis, on the ports the .env expects.
set -euo pipefail

PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
PGDATA=${PGDATA:-/home/user/.pgdata}
PGPORT=${PGPORT:-5432}

# PostgreSQL refuses to run as root. Where this script IS root (a container),
# drop to the postgres account for the server process only.
if [ "$(id -u)" = "0" ]; then
  RUN_AS_PG="su postgres -s /bin/bash -c"
  mkdir -p "$PGDATA"; chown -R postgres:postgres "$PGDATA"
else
  RUN_AS_PG="bash -c"
fi

if [ ! -d "$PGDATA" ]; then
  echo "initialising cluster at $PGDATA"
  mkdir -p "$PGDATA"
  $RUN_AS_PG "$PGBIN/initdb -D $PGDATA -U ninety --auth=trust" >/dev/null
fi

if ! "$PGBIN/pg_isready" -h localhost -p "$PGPORT" >/dev/null 2>&1; then
  $RUN_AS_PG "$PGBIN/pg_ctl -D $PGDATA -l /tmp/pg.log -o '-p $PGPORT -k /tmp' start"
  sleep 2
fi

psql -h localhost -p "$PGPORT" -U ninety -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='ninety'" \
  | grep -q 1 || createdb -h localhost -p "$PGPORT" -U ninety ninety

# Verify PostGIS is actually available. Do not skip this: every geo query in the
# product depends on it, and discovering its absence in Phase 02 is expensive.
psql -h localhost -p "$PGPORT" -U ninety -d ninety -c \
  "CREATE EXTENSION IF NOT EXISTS postgis; SELECT postgis_version();"

redis-cli ping >/dev/null 2>&1 || redis-server --daemonize yes --port 6379 --save '' --appendonly no
sleep 1
echo -n "redis: "; redis-cli ping
