# =============================================================================
# build-release-aab.ps1 — build a signed release AAB locally (Windows)
# =============================================================================
# Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File .\scripts\build-release-aab.ps1
#
# It performs the same steps as the GitHub Actions workflow:
#   1. npx expo prebuild --platform android --clean
#   2. inject release signing from credentials.json
#   3. Gradle bundleRelease
#   4. copy the AAB to apk-s/updated01/
#
# Requirements: Node.js, JDK 17+, Android SDK platform 36 + build-tools 36.0.0.
# =============================================================================

$ErrorActionPreference = 'Stop'

$mobileRoot = Split-Path -Parent $PSScriptRoot
Set-Location $mobileRoot

Write-Host ''
Write-Host '=== Sahi Kaarigar signed AAB build ===' -ForegroundColor Cyan

# ---------------------------------------------------------------------------
# 1. Load the release keystore settings from the gitignored credentials.json
# ---------------------------------------------------------------------------
$credentialsPath = Join-Path $mobileRoot 'credentials.json'
if (-not (Test-Path $credentialsPath)) {
    throw "credentials.json not found at $credentialsPath"
}

$credentials = Get-Content $credentialsPath -Raw | ConvertFrom-Json
$keystore = $credentials.android.keystore
$keystorePath = Join-Path $mobileRoot $keystore.keystorePath

if (-not (Test-Path $keystorePath)) {
    throw "Release keystore not found at $keystorePath"
}

$env:MYAPP_UPLOAD_STORE_FILE = (Resolve-Path $keystorePath).Path
$env:MYAPP_UPLOAD_STORE_PASSWORD = $keystore.keystorePassword
$env:MYAPP_UPLOAD_KEY_ALIAS = $keystore.keyAlias
$env:MYAPP_UPLOAD_KEY_PASSWORD = $keystore.keyPassword

Write-Host "Keystore: $env:MYAPP_UPLOAD_STORE_FILE"
Write-Host "Alias:    $env:MYAPP_UPLOAD_KEY_ALIAS"

# Fail early if the alias/password do not match the keystore.
& keytool -list -keystore $env:MYAPP_UPLOAD_STORE_FILE `
    -storepass $env:MYAPP_UPLOAD_STORE_PASSWORD `
    -alias $env:MYAPP_UPLOAD_KEY_ALIAS *> $null

if ($LASTEXITCODE -ne 0) {
    throw "keytool could not open the keystore with the configured alias/password."
}

# ---------------------------------------------------------------------------
# 2. Install JS dependencies if needed
# ---------------------------------------------------------------------------
if (-not (Test-Path (Join-Path $mobileRoot 'node_modules'))) {
    Write-Host ''
    Write-Host 'node_modules missing — running npm install...' -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw 'npm install failed.'
    }
}

# ---------------------------------------------------------------------------
# 3. Regenerate the native Android project from app.json
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host '[1/4] Expo prebuild...' -ForegroundColor Cyan
npx expo prebuild --platform android --no-install --clean
if ($LASTEXITCODE -ne 0) {
    throw 'expo prebuild failed.'
}

# ---------------------------------------------------------------------------
# 4. Replace Expo's debug signing config with the release signing config
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host '[2/4] Inject release signing...' -ForegroundColor Cyan
node scripts/inject-signing.js
if ($LASTEXITCODE -ne 0) {
    throw 'release signing injection failed.'
}

# ---------------------------------------------------------------------------
# 5. Build the release AAB
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host '[3/4] Gradle bundleRelease...' -ForegroundColor Cyan
Push-Location (Join-Path $mobileRoot 'android')
try {
    .\gradlew.bat bundleRelease --no-daemon
    if ($LASTEXITCODE -ne 0) {
        throw 'gradle bundleRelease failed.'
    }
}
finally {
    Pop-Location
}

$sourceAab = Join-Path $mobileRoot 'android\app\build\outputs\bundle\release\app-release.aab'
if (-not (Test-Path $sourceAab)) {
    throw "Gradle finished but the AAB was not found at $sourceAab"
}

# ---------------------------------------------------------------------------
# 6. Copy to a predictable location for upload
# ---------------------------------------------------------------------------
$repoRoot = Split-Path -Parent $mobileRoot
$outputDir = Join-Path $repoRoot 'apk-s\updated01'
New-Item -ItemType Directory -Path $outputDir -Force | Out-Null

$destinationAab = Join-Path $outputDir 'sahi-kaarigar-1.0.4-v12.aab'
Copy-Item $sourceAab $destinationAab -Force

# ---------------------------------------------------------------------------
# 7. Verify the AAB if bundletool is available
# ---------------------------------------------------------------------------
$bundletool = Join-Path $env:TEMP 'opencode\bundletool-all-1.18.3.jar'
if (Test-Path $bundletool) {
    Write-Host ''
    Write-Host '[verify] Checking versionCode, target SDK, debug flag, signer...' -ForegroundColor Cyan

    $manifest = & java -jar $bundletool dump manifest --bundle $destinationAab 2>&1
    if ($manifest -notmatch 'versionCode="12"') {
        throw 'AAB verification failed: versionCode is not 12.'
    }
    if ($manifest -notmatch 'targetSdkVersion="36"') {
        throw 'AAB verification failed: targetSdkVersion is not 36.'
    }
    if ($manifest -match 'android:debuggable="true"') {
        throw 'AAB verification failed: debuggable=true.'
    }

    $cert = & keytool -printcert -jarfile $destinationAab 2>&1
    if ($cert -notmatch '1F:E4:3E:A4:8E:39:44:CF:21:AD:0E:96:D0:C1:78:26:5D:2C:26:12:E4:27:CE:68:3D:46:ED:65:03:F4:5B:FC') {
        throw 'AAB verification failed: signer is not the release certificate.'
    }

    Write-Host '[verify] PASSED: v12, target 36, not debuggable, release-signed.' -ForegroundColor Green
}
else {
    Write-Host '[verify] bundletool not found; skipping manifest verification.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '[4/4] Done.' -ForegroundColor Green
Write-Host "AAB: $destinationAab"
Get-FileHash $destinationAab -Algorithm SHA256 | Format-List
