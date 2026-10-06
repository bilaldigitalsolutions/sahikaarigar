/**
 * Verifies the Supabase database setup: lists the tables, RPC functions and
 * storage buckets created by the migrations.
 *
 * Usage:  npm run db:verify
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnvFile() {
  const envPath = path.join(root, '.env.local');
  if (!existsSync(envPath)) return {};

  const env = {};
  for (const raw of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

const fileEnv = loadEnvFile();
const connectionString =
  process.env.DATABASE_URL || fileEnv.DATABASE_URL || fileEnv.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('✗ DATABASE_URL is not set in .env.local');
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();

  const { rows: tables } = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`
  );
  const { rows: functions } = await client.query(
    `select p.proname from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' order by p.proname`
  );

  console.log('TABLES (public):');
  for (const row of tables) console.log(`  - ${row.table_name}`);

  console.log('\nFUNCTIONS (public):');
  for (const row of functions) console.log(`  - ${row.proname}`);

  try {
    const { rows: buckets } = await client.query(
      'select id, public from storage.buckets order by id'
    );
    console.log('\nSTORAGE BUCKETS:');
    for (const row of buckets) console.log(`  - ${row.id} (public: ${row.public})`);
  } catch {
    console.log('\nSTORAGE BUCKETS: (not readable with this role)');
  }

  console.log('\n✓ Verification complete');
} catch (error) {
  console.error(`✗ Verification failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
