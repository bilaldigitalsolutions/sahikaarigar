# =============================================================================
# verify-apk.ps1
# Proves whether a Sahi Kaarigar APK actually contains the static PNG tab-icon
# fix. Run this BEFORE installing an APK downloaded from GitHub Actions.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\verify-apk.ps1 <path-to-apk>
#
# Checks:
#   1. Embedded Expo config matches app.json (versionName / versionCode).
#   2. The JS bundle contains the "[TabIcon]" marker emitted by
#      (tabs)/_layout.tsx. (The old "assets/icons" check was a false positive:
#      that string also exists in the Mappls library.)
#   3. The APK carries all four generated PNG payloads byte-for-byte, matched by
#      SHA-256 against assets/icons/*.png. Release resource names are
#      obfuscated, so path/size checks alone are not sufficient.
#
# Exit code: 0 = PASS, 1 = FAIL.
# =============================================================================
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ApkPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not (Test-Path $ApkPath)) {
    throw "APK not found: $ApkPath"
}

$apk = (Resolve-Path $ApkPath).Path
Write-Output "APK:  $apk"
Write-Output ("Size: {0:N1} MB" -f ((Get-Item $apk).Length / 1MB))
Write-Output ''

# Expected identity and icon payloads come from the repository so the verifier
# cannot silently drift from the source of truth.
$appJsonPath = Join-Path $PSScriptRoot '..\app.json'
$appJson = Get-Content $appJsonPath -Raw | ConvertFrom-Json
$expectedVersion = [string]$appJson.expo.version
$expectedCode = [int]$appJson.expo.android.versionCode
$sourceIconDir = Join-Path $PSScriptRoot '..\assets\icons'
$expected = [ordered]@{}
foreach ($name in @('home.png', 'briefcase.png', 'calendar.png', 'person.png')) {
    $src = Join-Path $sourceIconDir $name
    if (-not (Test-Path $src)) {
        throw "Source icon not found: $src"
    }
    $expected[$name] = @{
        Path   = $src
        Length = (Get-Item $src).Length
        Sha256 = (Get-FileHash $src -Algorithm SHA256).Hash.ToLowerInvariant()
    }
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($apk)
try {
    # --- 1. Embedded Expo config -------------------------------------------
    $versionOk = $false
    $cfgEntry = $zip.GetEntry('assets/app.config')
    if ($cfgEntry) {
        $ms = New-Object System.IO.MemoryStream
        $s = $cfgEntry.Open()
        $s.CopyTo($ms)
        $s.Dispose()
        $cfg = ([Text.Encoding]::UTF8.GetString($ms.ToArray())) | ConvertFrom-Json
        $actualVersion = [string]$cfg.version
        $actualCode = [int]$cfg.android.versionCode
        Write-Output ("versionName: {0} (expected {1})" -f $actualVersion, $expectedVersion)
        Write-Output ("versionCode: {0} (expected {1})" -f $actualCode, $expectedCode)
        $versionOk = ($actualVersion -eq $expectedVersion -and $actualCode -eq $expectedCode)
    }
    else {
        Write-Output 'versionName: <assets/app.config not found>'
        Write-Output 'versionCode: <assets/app.config not found>'
    }
    Write-Output ''

    # --- 2. JS bundle scan ---------------------------------------------------
    $bundleEntry = $zip.GetEntry('assets/index.android.bundle')
    if (-not $bundleEntry) {
        throw 'assets/index.android.bundle not found - is this a release APK?'
    }

    $ms = New-Object System.IO.MemoryStream
    $s = $bundleEntry.Open()
    $s.CopyTo($ms)
    $s.Dispose()
    $bytes = $ms.ToArray()
    $latin = [Text.Encoding]::GetEncoding(28591).GetString($bytes)
    Write-Output ("JS bundle: {0} bytes" -f $bytes.Length)

    $hasCodeMarker = $latin.IndexOf('[TabIcon]', [StringComparison]::Ordinal) -ge 0
    Write-Output ("bundle contains '[TabIcon]' code marker: {0}" -f $hasCodeMarker)
    $hasBuildStamp = [regex]::IsMatch($latin, 'run\d{3,}')
    Write-Output ("bundle contains runNNN build stamp: {0}" -f $hasBuildStamp)
    Write-Output ''

    # --- 3. PNG payload check ------------------------------------------------
    $pngEntries = @($zip.Entries | Where-Object {
        $_.FullName -like '*.png' -and $_.FullName -notlike '*.9.png'
    })
    $found = 0
    foreach ($name in $expected.Keys) {
        $src = $expected[$name]
        $hit = $null
        foreach ($entry in @($pngEntries | Where-Object { $_.Length -eq $src.Length })) {
            $entryMs = New-Object System.IO.MemoryStream
            $entryStream = $entry.Open()
            $entryStream.CopyTo($entryMs)
            $entryStream.Dispose()
            $sha = [System.Security.Cryptography.SHA256]::Create()
            try {
                $hashBytes = $sha.ComputeHash($entryMs.ToArray())
            }
            finally {
                $sha.Dispose()
                $entryMs.Dispose()
            }
            $hash = ([BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
            if ($hash -eq $src.Sha256) {
                $hit = $entry
                break
            }
        }
        if ($hit) {
            $found++
            Write-Output ("icon payload {0,-14} ({1,3} bytes, sha256 match): FOUND as {2}" -f $name, $src.Length, $hit.FullName)
        }
        else {
            Write-Output ("icon payload {0,-14} ({1,3} bytes, sha256 match): NOT FOUND" -f $name, $src.Length)
        }
    }
    Write-Output ''

    # --- 4. Verdict ----------------------------------------------------------
    $reasons = @()
    if (-not $versionOk) { $reasons += 'version does not match app.json' }
    if (-not $hasCodeMarker) { $reasons += 'missing [TabIcon] code marker' }
    if ($found -ne 4) { $reasons += ("only {0}/4 icon payloads matched by SHA-256" -f $found) }

    if ($reasons.Count -eq 0) {
        Write-Output 'VERDICT: PASS - version, tab-icon code marker and all four byte-identical PNG payloads verified.'
        exit 0
    }

    Write-Output ("VERDICT: FAIL - {0}." -f ($reasons -join '; '))
    Write-Output '         This APK must not be installed as the tab-icon fix.'
    exit 1
}
finally {
    $zip.Dispose()
}
