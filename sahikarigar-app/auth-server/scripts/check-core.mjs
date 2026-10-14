/**
 * Is the SuperTokens Core reachable with the credentials in auth-server/.env?
 *
 * Run this BEFORE deploying to Render — a typo in the Connection URI is the
 * most common cause of "auth works locally but not on the server".
 *
 * Usage:  cd auth-server && npm run check-core
 */
import 'dotenv/config';

const uri = (process.env.SUPERTOKENS_CONNECTION_URI || '').trim().replace(/\/+$/, '');
const apiKey = (process.env.SUPERTOKENS_API_KEY || '').trim();

if (!uri) {
  console.error('✗ SUPERTOKENS_CONNECTION_URI is not set in auth-server/.env');
  process.exit(1);
}

console.log('\n🔎 SuperTokens Core check');
console.log(`   URI     : ${uri}`);
console.log(`   API key : ${apiKey ? `set (${apiKey.length} chars)` : '(none)'}\n`);

try {
  const res = await fetch(`${uri}/hello`, {
    headers: apiKey ? { 'api-key': apiKey } : {},
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.text()).slice(0, 200);

  console.log(`GET ${uri}/hello  ->  HTTP ${res.status}`);
  console.log(`body: ${body}\n`);

  if (res.ok) {
    console.log('✅ Core is reachable.');
    console.log('   Next: put the SAME URI + API key into the Render environment');
    console.log('   (RENDER_DEPLOY.md step 4), then check /health on the service.\n');
  } else {
    console.log('❌ The Core answered but not with 200 — double-check the URI.');
    console.log('   (A 401 usually means the API key does not match the instance.)\n');
    process.exitCode = 1;
  }
} catch (error) {
  console.log(`❌ Could not reach the Core: ${error.message}`);
  console.log('   • is the URI correct (https://…supertokens.io, no trailing slash)?');
  console.log('   • did the instance finish deploying in the SuperTokens dashboard?\n');
  process.exitCode = 1;
}
