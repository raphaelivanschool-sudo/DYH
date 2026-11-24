#!/usr/bin/env bash
# Runs the migrations, the seed and the smoke test against a local Postgres 15+.
#   PGHOST=localhost PGUSER=postgres ./supabase/tests/run-local.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=${DB:-dyh_test}
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/local-shim.sql
for f in supabase/migrations/*.sql supabase/seed.sql; do psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"; done
psql -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/smoke.sql | grep -E "^==|ok|SHOULD|ERROR|ALL DONE"
