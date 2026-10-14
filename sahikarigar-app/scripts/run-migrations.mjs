/**
 * Runs every SQL file in supabase/migrations (in filename order) against your
 * Supabase database.
 *
 * Usage:
 *   npm run db:migrate
 *
 * It reads the connection string from DATABASE_URL (in .env.local or the
 * environment). Get it from Supabase Dashboard -> Connect -> Session pooler.
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/** Tiny .env parser (avoids adding a dotenv dependency). */
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
  console.error(`
✗ DATABASE_URL is not set.

Add it to .env.local (Supabase Dashboard -> Connect -> Session pooler):

  DATABASE_URL=postgresql://postgres.kgnryuxrxfbztfzlsyz:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres

Then run:  npm run db:migrate
`);
  process.exit(1);
}

const migrationsDir = path.join(root, 'supabase', 'migrations');
const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('✗ No .sql files found in supabase/migrations');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log('✓ Connected to the database\n');

  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8');
    process.stdout.write(`▶ ${file} ... `);
    await client.query(sql); // multi-statement SQL is supported
    console.log('OK');
  }

  console.log('\n✓ All migrations applied successfully');
} catch (error) {
  console.error(`\n✗ Migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
