import '../load-env.js';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDb, getSql } from './client.js';

/**
 * Migrations.
 *
 * Plain SQL, applied in filename order, each one paired with a `.down.sql` so
 * the set is reversible. Plain SQL rather than generated migrations because the
 * DDL that matters here — `GEOGRAPHY(POINT,4326)`, the CHECK constraints that
 * make an order's arithmetic reconcile in the database — is the part a generator
 * would quietly get wrong.
 */

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

interface Migration {
  readonly name: string;
  readonly up: string;
  readonly down: string;
}

export function loadMigrations(): Migration[] {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.up.sql')).sort();
  return files.map((f) => {
    const name = f.replace(/\.up\.sql$/, '');
    return {
      name,
      up: readFileSync(join(migrationsDir, f), 'utf8'),
      down: readFileSync(join(migrationsDir, `${name}.down.sql`), 'utf8'),
    };
  });
}

async function ensureLedger(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

export async function appliedMigrations(): Promise<string[]> {
  await ensureLedger();
  const rows = await getSql()<{ name: string }[]>`SELECT name FROM schema_migrations ORDER BY name`;
  return rows.map((r) => r.name);
}

export async function migrateUp(log: (s: string) => void = console.log): Promise<string[]> {
  await ensureLedger();
  const sql = getSql();
  const done = new Set(await appliedMigrations());
  const applied: string[] = [];
  for (const m of loadMigrations()) {
    if (done.has(m.name)) {
      log(`  = ${m.name} (already applied)`);
      continue;
    }
    log(`  ↑ ${m.name}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(m.up);
      await tx`INSERT INTO schema_migrations (name) VALUES (${m.name})`;
    });
    applied.push(m.name);
  }
  return applied;
}

export async function migrateDown(steps = 1, log: (s: string) => void = console.log): Promise<string[]> {
  await ensureLedger();
  const sql = getSql();
  const done = await appliedMigrations();
  const all = loadMigrations();
  const reverted: string[] = [];
  for (const name of done.slice(-steps).reverse()) {
    const m = all.find((x) => x.name === name);
    if (!m) throw new Error(`no down migration on disk for ${name}`);
    log(`  ↓ ${name}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(m.down);
      await tx`DELETE FROM schema_migrations WHERE name = ${name}`;
    });
    reverted.push(name);
  }
  return reverted;
}

export async function resetDatabase(log: (s: string) => void = console.log): Promise<void> {
  const sql = getSql();
  log('  ⟲ dropping public schema');
  await sql.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrateUp(log);
}

const isEntrypoint = process.argv[1] !== undefined && process.argv[1].endsWith('migrate.ts');
if (isEntrypoint) {
  const args = new Set(process.argv.slice(2));
  const run = async () => {
    if (args.has('--reset')) {
      console.log('resetting database');
      await resetDatabase();
    } else if (args.has('--down')) {
      console.log('reverting one migration');
      await migrateDown(1);
    } else {
      console.log('applying migrations');
      const applied = await migrateUp();
      console.log(applied.length === 0 ? 'database already up to date' : `applied ${applied.length} migration(s)`);
    }
    const rows = await getSql()<{ n: string }[]>`
      SELECT count(*)::text AS n FROM information_schema.tables WHERE table_schema = 'public'
    `;
    console.log(`public schema now holds ${rows[0]?.n ?? '?'} tables`);
    await closeDb();
  };
  run().catch(async (err) => {
    console.error(err);
    await closeDb();
    process.exit(1);
  });
}
