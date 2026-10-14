#!/usr/bin/env node
// =============================================================================
// inject-signing.js — release signing config inject karta hai
// =============================================================================
// `npx expo prebuild` ke baad chalao. Expo ka generated build.gradle release
// build par debug signingConfig lagata hai, isliye hum yahan ek `release`
// signingConfig add karte hain jo values environment variables se padhta hai.
//
//   MYAPP_UPLOAD_STORE_FILE     -> keystore file ka path (e.g. $RUNNER_TEMP/keystore.jks)
//   MYAPP_UPLOAD_STORE_PASSWORD -> keystore ka password
//   MYAPP_UPLOAD_KEY_ALIAS      -> key alias
//   MYAPP_UPLOAD_KEY_PASSWORD   -> key password
//
// Ye charo variables isi step ke env me aane chahiye (workflow me define hue
// hain). Script inhe build.gradle me `System.getenv(...)` ke roop me likhti
// hai, taaki Gradle ke time par value milti rahe — secret file me hardcode
// nahi hota. Agar koi variable missing hai toh build waise bhi chalega, par
// release APK debug key se sign hoga (sideload ke liye theek, Play ke liye nahi).
//
// Ye script idempotent hai — dobara chalne par duplicate block nahi banega.
// =============================================================================

const fs = require('fs');
const path = require('path');

const REQUIRED_ENV = [
  'MYAPP_UPLOAD_STORE_FILE',
  'MYAPP_UPLOAD_STORE_PASSWORD',
  'MYAPP_UPLOAD_KEY_ALIAS',
  'MYAPP_UPLOAD_KEY_PASSWORD',
];

// Release signing block — env vars se value padhta hai (secret hardcode nahi).
const SIGNING_CONFIG = `        release {
            storeFile System.getenv("MYAPP_UPLOAD_STORE_FILE") ? file(System.getenv("MYAPP_UPLOAD_STORE_FILE")) : null
            storePassword System.getenv("MYAPP_UPLOAD_STORE_PASSWORD")
            keyAlias System.getenv("MYAPP_UPLOAD_KEY_ALIAS")
            keyPassword System.getenv("MYAPP_UPLOAD_KEY_PASSWORD")
        }
`;

function main() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.warn(
      '[inject-signing] Missing env vars: ' +
        missing.join(', ') +
        '\n[inject-signing] Release APK debug signingConfig se sign hoga.',
    );
  }

  const scriptDir = path.dirname(path.resolve(process.argv[1] || 'scripts/inject-signing.js'));
  const buildGradlePath = path.join(scriptDir, '..', 'android', 'app', 'build.gradle');
  if (!fs.existsSync(buildGradlePath)) {
    console.error(
      '[inject-signing] build.gradle nahi mila: ' +
        buildGradlePath +
        '\n[inject-signing] Pehle `npx expo prebuild --platform android` chalao.',
    );
    process.exit(1);
  }

  let source = fs.readFileSync(buildGradlePath, 'utf8');

  // Idempotent: agar pehle se inject ho chuka hai toh kuch mat karo.
  if (source.includes('MYAPP_UPLOAD_STORE_FILE')) {
    console.log('[inject-signing] Release signingConfig pehle se maujood hai — skip.');
    return;
  }

  // 1) signingConfigs { ... } ke andar release block add karo.
  const signingConfigsIndex = source.indexOf('signingConfigs {');
  if (signingConfigsIndex === -1) {
    console.error('[inject-signing] `signingConfigs {` block nahi mila build.gradle me.');
    process.exit(1);
  }
  const openBraceIndex = source.indexOf('{', signingConfigsIndex);
  const insertAt = source.indexOf('\n', openBraceIndex) + 1;
  source = source.slice(0, insertAt) + SIGNING_CONFIG + source.slice(insertAt);

  // 2) buildTypes.release ko release signingConfig par point karao.
  //    Template me ye line hamesha `signingConfig signingConfigs.debug` hoti
  //    hai — par agar kisi ne pehle hi badal diya ho toh bhi hum handle karenge.
  const buildTypesIndex = source.indexOf('buildTypes {');
  if (buildTypesIndex === -1) {
    console.error('[inject-signing] `buildTypes {` block nahi mila build.gradle me.');
    process.exit(1);
  }
  const releaseIndex = source.indexOf('release {', buildTypesIndex);
  if (releaseIndex === -1) {
    console.error('[inject-signing] `buildTypes { release {` block nahi mila.');
    process.exit(1);
  }
  const releaseEndIndex = findBlockEnd(source, releaseIndex);
  const releaseBlock = source.slice(releaseIndex, releaseEndIndex);
  const patchedRelease = releaseBlock.replace(
    /signingConfig\s+signingConfigs\.\w+/,
    'signingConfig signingConfigs.release',
  );
  if (patchedRelease === releaseBlock && !releaseBlock.includes('signingConfigs.release')) {
    console.warn(
      '[inject-signing] buildTypes.release me signingConfig line nahi mili — ' +
        'wahi chhod diya gaya.',
    );
  }
  source = source.slice(0, releaseIndex) + patchedRelease + source.slice(releaseEndIndex);

  fs.writeFileSync(buildGradlePath, source, 'utf8');
  console.log('[inject-signing] Release signingConfig inject ho gaya → ' + buildGradlePath);
  if (missing.length === 0) {
    console.log(
      '[inject-signing] Sign karenge: alias="' +
        process.env.MYAPP_UPLOAD_KEY_ALIAS +
        '", store="' +
        process.env.MYAPP_UPLOAD_STORE_FILE +
        '"',
    );
  }
}

/**
 * Kisi bhi block ke matching closing curly bracket ka index dhoondta hai.
 * `startIndex` par `{` ya `w {` ke baad ka position maana jaata hai.
 */
function findBlockEnd(text, startIndex) {
  const openBraceIndex = text.indexOf('{', startIndex);
  if (openBraceIndex === -1) return text.length;
  let depth = 0;
  for (let i = openBraceIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

main();
