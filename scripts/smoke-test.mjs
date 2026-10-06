/**
 * Smoke test: exercises the exact REST calls the app makes through
 * @supabase/supabase-js (including the `search_workers` RPC and the
 * nested user joins).
 *
 * Usage:  npm run db:smoke
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

const env = { ...loadEnvFile(), ...process.env };
const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!baseUrl || !serviceKey) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function call(label, request) {
  try {
    const res = await request();
    const body = await res.text();
    const ok = res.status >= 200 && res.status < 300;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  [HTTP ${res.status}]`);
    if (!ok) console.log(`      ${body.slice(0, 400)}`);
    else {
      const parsed = JSON.parse(body);
      const count = Array.isArray(parsed) ? parsed.length : 1;
      console.log(`      -> ${count} row(s)`);
      if (Array.isArray(parsed) && parsed[0]) {
        console.log(`      -> sample: ${JSON.stringify(parsed[0]).slice(0, 220)}`);
      }
    }
    return ok;
  } catch (error) {
    console.log(`FAIL  ${label}  -> ${error.message}`);
    return false;
  }
}

const results = [];

results.push(
  await call('RPC search_workers (area = ameerpet)', () =>
    fetch(`${baseUrl}/rest/v1/rpc/search_workers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_area: 'ameerpet' }),
    })
  )
);

results.push(
  await call('RPC search_workers (within 10 km of Ameerpet)', () =>
    fetch(`${baseUrl}/rest/v1/rpc/search_workers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_lat: 17.4374,
        p_lng: 78.4485,
        p_max_distance: 10,
      }),
    })
  )
);

results.push(
  await call('RPC search_workers (skill = plumber)', () =>
    fetch(`${baseUrl}/rest/v1/rpc/search_workers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_skills: ['plumber'] }),
    })
  )
);

results.push(
  await call('worker_profiles + nested users join', () =>
    fetch(
      `${baseUrl}/rest/v1/worker_profiles?select=*,user:users(id,name,avatar,location_area,location_city)&is_approved=eq.true&limit=5`,
      { headers }
    )
  )
);

results.push(
  await call('users table readable', () =>
    fetch(`${baseUrl}/rest/v1/users?select=id,name,phone,role&limit=5`, { headers })
  )
);

results.push(
  await call('RPC get_area_stats (area = kukatpally)', () =>
    fetch(`${baseUrl}/rest/v1/rpc/get_area_stats`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_area: 'kukatpally' }),
    })
  )
);

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exitCode = passed === results.length ? 0 : 1;
