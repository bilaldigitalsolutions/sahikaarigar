/**
 * Builds the app as a fully static site into `out/`.
 *
 * Why: Firebase Hosting on the free (Spark) plan can only serve static files.
 * Server-side rendering / Route Handlers need Cloud Functions, and Cloud
 * Functions require the paid Blaze plan — which this build avoids entirely.
 *
 * `STATIC_EXPORT=1` makes next.config.js switch to `output: "export"` and to
 * ignore `route.ts` files (see pageExtensions there), so the API routes stay in
 * the repo for later use but are not part of the static bundle.
 *
 * Usage:  npm run build:static
 */
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nextBin = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next');

/** Minimal dotenv parser. */
function loadEnvFile(file) {
  const env = {};
  if (!existsSync(file)) return env;

  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
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

// `.env.local` holds the LOCAL dev values (e.g. NEXT_PUBLIC_AUTH_API_URL points
// at http://localhost:4000) and Next.js reads it for every build — which would
// bake localhost into the production bundle. So the production file wins here.
const productionEnv = loadEnvFile(path.join(root, '.env.sahi-kaarigar'));

console.log('▶ Building static export (out/) — no Cloud Functions needed');
console.log(
  productionEnv.NEXT_PUBLIC_AUTH_API_URL === undefined
    ? '  (no .env.sahi-kaarigar — falling back to .env.local)\n'
    : `  auth API: ${productionEnv.NEXT_PUBLIC_AUTH_API_URL || '(not configured)'}\n`,
);

const child = spawn(process.execPath, [nextBin, 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ...productionEnv, STATIC_EXPORT: '1' },
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✓ Static build ready — deploy with: firebase deploy --only hosting');
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(`✗ Failed to start the build: ${error.message}`);
  process.exit(1);
});
