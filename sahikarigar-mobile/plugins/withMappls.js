// =============================================================================
// Expo config plugin — wires the Mappls (MapmyIndia) native Maps SDK into the
// Android project that `expo prebuild` generates.
// =============================================================================
// It does two things (the Mappls React Native SDK ships no working config
// plugin of its own — its `app.plugin.js` points at a folder that isn't
// published — so we do it here):
//
//   1. Adds the Mappls Maven repository so the SDK's AARs can be resolved.
//   2. Copies the downloaded `<appId>.a.conf` / `<appId>.a.olf` files from
//      `mappls-config/` into `android/app/` (the app-module root), which is
//      where the Mappls Gradle plugin looks for them.
//
// Usage: add "./plugins/withMappls" to the `plugins` array in app.json, then
//   npx expo prebuild --platform android
// =============================================================================

const { withDangerousMod, withProjectBuildGradle, withSettingsGradle } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = 'maven.mappls.com';

const mavenSnippet = (language) =>
  language === 'kotlin'
    ? 'maven { url = uri("https://maven.mappls.com/repository/mappls/") }'
    : "maven { url 'https://maven.mappls.com/repository/mappls/' }";

/**
 * Insert the Mappls maven repo right after the first `repositories {` block that
 * follows `anchorPattern`. No-op when the marker is already present.
 */
function injectRepo(contents, anchorPattern, language) {
  if (contents.includes(MARKER)) return contents;

  const match = anchorPattern.exec(contents);
  if (!match) return contents;

  const insertAt = match.index + match[0].length;
  const indent = '        ';
  return (
    contents.slice(0, insertAt) +
    `\n${indent}${mavenSnippet(language)}` +
    contents.slice(insertAt)
  );
}

const withMapplsRepo = (config) => {
  // android/build.gradle(.kts) -> allprojects { repositories { ... } }
  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'kotlin') {
      cfg.modResults.contents = injectRepo(
        cfg.modResults.contents,
        /allprojects\s*\{[\s\S]*?repositories\s*\{/,
        'kotlin',
      );
    } else {
      cfg.modResults.contents = injectRepo(
        cfg.modResults.contents,
        /allprojects\s*\{[\s\S]*?repositories\s*\{/,
        'groovy',
      );
    }
    return cfg;
  });

  // android/settings.gradle(.kts) -> dependencyResolutionManagement { repositories { ... } }
  config = withSettingsGradle(config, (cfg) => {
    const language = cfg.modResults.language === 'kotlin' ? 'kotlin' : 'groovy';
    cfg.modResults.contents = injectRepo(
      cfg.modResults.contents,
      /dependencyResolutionManagement\s*\{[\s\S]*?repositories\s*\{/,
      language,
    );
    return cfg;
  });

  return config;
};

const withMapplsConfigFiles = (config) =>
  withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const sourceDir = path.join(projectRoot, 'mappls-config');
      const appDir = path.join(projectRoot, 'android', 'app');

      if (!fs.existsSync(sourceDir)) {
        throw new Error(
          '[withMappls] Missing `mappls-config/` folder. Download <appId>.a.conf and <appId>.a.olf ' +
            'from the Mappls console (https://auth.mappls.com/console) and place them there.',
        );
      }

      const files = fs
        .readdirSync(sourceDir)
        .filter((name) => name.endsWith('.a.conf') || name.endsWith('.a.olf'));

      if (!files.some((f) => f.endsWith('.a.olf')) || !files.some((f) => f.endsWith('.a.conf'))) {
        throw new Error(
          '[withMappls] Both a `.a.olf` and a `.a.conf` file are required in `mappls-config/`.',
        );
      }

      if (!fs.existsSync(appDir)) fs.mkdirSync(appDir, { recursive: true });

      for (const file of files) {
        fs.copyFileSync(path.join(sourceDir, file), path.join(appDir, file));
      }

      return cfg;
    },
  ]);

module.exports = (config) => withMapplsConfigFiles(withMapplsRepo(config));
