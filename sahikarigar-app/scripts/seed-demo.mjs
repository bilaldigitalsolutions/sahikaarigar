/**
 * Seeds a few demo users + worker profiles so you can try the app locally.
 * Idempotent - safe to run multiple times.
 *
 * Usage:  npm run db:seed
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

const USERS = [
  {
    firebase_uid: 'demo-worker-raj',
    phone: '9876543210',
    name: 'Raj Kumar',
    role: 'worker',
    location_area: 'Ameerpet',
    location_city: 'Hyderabad',
    lat: 17.4374,
    lng: 78.4485,
  },
  {
    firebase_uid: 'demo-worker-ahmed',
    phone: '9876543211',
    name: 'Ahmed Ali',
    role: 'worker',
    location_area: 'Kukatpally',
    location_city: 'Hyderabad',
    lat: 17.4849,
    lng: 78.4139,
  },
  {
    firebase_uid: 'demo-worker-priya',
    phone: '9876543212',
    name: 'Priya Singh',
    role: 'worker',
    location_area: 'Gachibowli',
    location_city: 'Hyderabad',
    lat: 17.4401,
    lng: 78.3489,
  },
  {
    firebase_uid: 'demo-employer-1',
    phone: '9876543213',
    name: 'Bilal Ahmed',
    role: 'employer',
    location_area: 'Mehdipatnam',
    location_city: 'Hyderabad',
    lat: 17.3947,
    lng: 78.4397,
  },
];

const WORKERS = [
  {
    uid: 'demo-worker-raj',
    skills: ['electrician', 'wiring'],
    experience: 5,
    description: 'FaN, light aur wiring ka 5 saal ka tajurba.',
    hourly_rate: 300,
    service_areas: ['ameerpet', 'sr nagar', 'sanath nagar'],
    rating_average: 4.8,
    rating_count: 45,
    completed_jobs: 120,
  },
  {
    uid: 'demo-worker-ahmed',
    skills: ['plumber', 'pipe fitting'],
    experience: 3,
    description: 'Tap, pipeline aur bathroom fitting ka kaam.',
    hourly_rate: 250,
    service_areas: ['kukatpally', 'kphb', 'miyapur'],
    rating_average: 4.5,
    rating_count: 23,
    completed_jobs: 67,
  },
  {
    uid: 'demo-worker-priya',
    skills: ['painter', 'wall painting'],
    experience: 4,
    description: 'Ghar aur office ki painting, putty ka kaam.',
    hourly_rate: 350,
    service_areas: ['gachibowli', 'madhapur', 'hitech city'],
    rating_average: 4.9,
    rating_count: 67,
    completed_jobs: 156,
  },
];

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();

  for (const user of USERS) {
    await client.query(
      `insert into public.users
         (firebase_uid, phone, name, role, location_area, location_city, lat, lng, is_verified)
       values ($1, $2, $3, $4, $5, $6, $7, $8, true)
       on conflict (firebase_uid) do update
         set name = excluded.name,
             phone = excluded.phone,
             location_area = excluded.location_area,
             location_city = excluded.location_city,
             lat = excluded.lat,
             lng = excluded.lng`,
      [
        user.firebase_uid,
        user.phone,
        user.name,
        user.role,
        user.location_area,
        user.location_city,
        user.lat,
        user.lng,
      ]
    );
    console.log(`  user  ${user.name} (${user.phone})`);
  }

  for (const worker of WORKERS) {
    await client.query(
      `insert into public.worker_profiles
         (user_id, skills, experience, description, hourly_rate, service_areas,
          lat, lng, rating_average, rating_count, completed_jobs,
          is_approved, availability)
       select id, $2, $3, $4, $5, $6, u.lat, u.lng, $7, $8, $9, true, 'available'
         from public.users u
        where u.firebase_uid = $1
       on conflict (user_id) do update
         set skills = excluded.skills,
             experience = excluded.experience,
             description = excluded.description,
             hourly_rate = excluded.hourly_rate,
             service_areas = excluded.service_areas,
             rating_average = excluded.rating_average,
             rating_count = excluded.rating_count,
             completed_jobs = excluded.completed_jobs,
             is_approved = true,
             availability = 'available'`,
      [
        worker.uid,
        worker.skills,
        worker.experience,
        worker.description,
        worker.hourly_rate,
        worker.service_areas,
        worker.rating_average,
        worker.rating_count,
        worker.completed_jobs,
      ]
    );
    console.log(`  worker ${worker.skills.join(', ')} @ ₹${worker.hourly_rate}/hr`);
  }

  const { rows: counts } = await client.query(
    `select
       (select count(*) from public.users) as users,
       (select count(*) from public.worker_profiles) as workers`
  );
  console.log(`\n✓ Seed complete - ${counts[0].users} users, ${counts[0].workers} worker profiles`);
} catch (error) {
  console.error(`✗ Seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
