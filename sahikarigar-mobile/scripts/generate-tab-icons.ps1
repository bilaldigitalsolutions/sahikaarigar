# =============================================================================
# generate-tab-icons.ps1
# Generates static PNG tab-bar icons (home / briefcase / calendar / person)
# as pure geometric shapes - NO font rendering is involved anywhere.
#
# Why: the test devices cannot render runtime-registered icon fonts (Ionicons)
# or emoji glyphs - both render as empty squares. Static bundled PNGs are the
# only render path that bypasses the device font stack entirely.
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\generate-tab-icons.ps1
# Output: assets/icons/home.png, briefcase.png, calendar.png, person.png
# =============================================================================

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression

$outDir = Join-Path $PSScriptRoot '..\assets\icons'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$scale = 2                                  # 24x24 logical art -> 48x48 PNG (crisp on high-DPI)
$gridSize = 24
$fillR = 17; $fillG = 24; $fillB = 39; $fillA = 255   # #111827 (neutral dark, tinted at render)

# --- CRC32 (PNG standard, poly 0xEDB88320) -----------------------------------
function Get-Crc32([byte[]]$data) {
    $table = New-Object 'System.Collections.Generic.List[long]'
    for ($n = 0; $n -lt 256; $n++) {
        $c = [long]$n
        for ($k = 0; $k -lt 8; $k++) {
            if (($c -band 1) -ne 0) { $c = (0xEDB88320 -bxor ($c -shr 1)) } else { $c = $c -shr 1 }
        }
        $table.Add($c)
    }
    $crc = 0xFFFFFFFF
    foreach ($b in $data) {
        $crc = ($table[[int](($crc -bxor $b) -band 0xFF)]) -bxor ($crc -shr 8)
    }
    return ($crc -bxor 0xFFFFFFFF) -band 0xFFFFFFFF
}

# --- Adler-32 (zlib trailer) --------------------------------------------------
function Get-Adler32([byte[]]$data) {
    $a = [long]1; $b = [long]0
    foreach ($x in $data) {
        $a = ($a + $x) % 65521
        $b = ($b + $a) % 65521
    }
    return (($b -shl 16) -bor $a) -band 0xFFFFFFFF
}

# --- PNG chunk writer ----------------------------------------------------------
function Add-PngChunk([System.Collections.Generic.List[byte]]$out, [string]$type, [byte[]]$data) {
    $len = [long]$data.Length
    $out.AddRange([byte[]]@(
        (($len -shr 24) -band 0xFF), (($len -shr 16) -band 0xFF),
        (($len -shr 8) -band 0xFF), ($len -band 0xFF)
    ))
    $typeBytes = [System.Text.Encoding]::ASCII.GetBytes($type)
    $out.AddRange($typeBytes)
    $out.AddRange([byte[]]$data)

    $crcInput = New-Object byte[] ($data.Length + 4)
    $typeBytes.CopyTo($crcInput, 0)
    $data.CopyTo($crcInput, 4)
    $crc = Get-Crc32 $crcInput
    $out.AddRange([byte[]]@(
        (($crc -shr 24) -band 0xFF), (($crc -shr 16) -band 0xFF),
        (($crc -shr 8) -band 0xFF), ($crc -band 0xFF)
    ))
}

# --- RGBA pixel array -> full PNG file bytes -----------------------------------
function ConvertTo-Png([byte[]]$rgba, [int]$w, [int]$h) {
    # Raw scanlines, each prefixed with filter byte 0 (None)
    $raw = New-Object 'System.Collections.Generic.List[byte]'
    for ($y = 0; $y -lt $h; $y++) {
        $raw.Add(0)
        for ($x = 0; $x -lt $w; $x++) {
            $i = (($y * $w) + $x) * 4
            $raw.Add($rgba[$i]); $raw.Add($rgba[$i + 1]); $raw.Add($rgba[$i + 2]); $raw.Add($rgba[$i + 3])
        }
    }
    $rawArr = $raw.ToArray()

    # zlib wrapper: 0x78 0x01 + raw DEFLATE + Adler-32 (big-endian)
    $ms = New-Object System.IO.MemoryStream
    $ds = New-Object System.IO.Compression.DeflateStream($ms, [System.IO.Compression.CompressionLevel]::Optimal, $true)
    $ds.Write($rawArr, 0, $rawArr.Length)
    $ds.Dispose()
    $deflated = $ms.ToArray()
    $ms.Dispose()

    $idat = New-Object 'System.Collections.Generic.List[byte]'
    $idat.Add(0x78); $idat.Add(0x01)
    $idat.AddRange([byte[]]$deflated)
    $adler = Get-Adler32 $rawArr
    $idat.AddRange([byte[]]@(
        (($adler -shr 24) -band 0xFF), (($adler -shr 16) -band 0xFF),
        (($adler -shr 8) -band 0xFF), ($adler -band 0xFF)
    ))
    $idatArr = $idat.ToArray()

    # IHDR: width(4BE) height(4BE) bitDepth=8 colorType=6(RGBA) compression=0 filter=0 interlace=0
    $ihdr = [byte[]]@(
        (($w -shr 24) -band 0xFF), (($w -shr 16) -band 0xFF), (($w -shr 8) -band 0xFF), ($w -band 0xFF),
        (($h -shr 24) -band 0xFF), (($h -shr 16) -band 0xFF), (($h -shr 8) -band 0xFF), ($h -band 0xFF),
        8, 6, 0, 0, 0
    )

    $png = New-Object 'System.Collections.Generic.List[byte]'
    $png.AddRange([byte[]]@(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))
    Add-PngChunk $png 'IHDR' $ihdr
    Add-PngChunk $png 'IDAT' $idatArr
    Add-PngChunk $png 'IEND' @()
    return $png.ToArray()
}

# --- Icon generator: 24x24 '#'/'.' art -> scaled PNG ---------------------------
function New-Icon([string]$name, [string[]]$art) {
    if ($art.Count -ne $gridSize) { throw "$name : expected $gridSize rows, got $($art.Count)" }
    foreach ($row in $art) {
        if ($row.Length -ne $gridSize) { throw "$name : row length $($row.Length) != $gridSize" }
    }
    $w = $gridSize * $scale
    $h = $gridSize * $scale
    $rgba = New-Object byte[] ($w * $h * 4)
    for ($ay = 0; $ay -lt $gridSize; $ay++) {
        for ($ax = 0; $ax -lt $gridSize; $ax++) {
            if ($art[$ay][$ax] -eq '#') {
                for ($sy = 0; $sy -lt $scale; $sy++) {
                    for ($sx = 0; $sx -lt $scale; $sx++) {
                        $px = (((($ay * $scale) + $sy) * $w) + (($ax * $scale) + $sx)) * 4
                        $rgba[$px] = $fillR; $rgba[$px + 1] = $fillG; $rgba[$px + 2] = $fillB; $rgba[$px + 3] = $fillA
                    }
                }
            }
        }
    }
    $png = ConvertTo-Png $rgba $w $h
    $path = Join-Path $outDir "$name.png"
    [System.IO.File]::WriteAllBytes($path, [byte[]]$png)
    Write-Output ("wrote {0}  ({1} bytes, {2}x{2})" -f $path, $png.Length, $w)
}

# --- Icon artwork (24x24 logical grids, '#' = filled) ---------------------------

# HOME - roof triangle + body with a door cutout
$homeArt = @(
    '........................',
    '........................',
    '........................',
    '...........##...........',
    '..........####..........',
    '.........######.........',
    '........########........',
    '.......##########.......',
    '......############......',
    '.....##############.....',
    '....################....',
    '...##################...',
    '..####################..',
    '..########....########..',
    '..#########..#########..',
    '..#########..#########..',
    '..#########..#########..',
    '..#########..#########..',
    '..#########..#########..',
    '..#########..#########..',
    '..####################..',
    '........................',
    '........................',
    '........................'
)

# BRIEFCASE - handle + solid case + latch cutout
$briefcase = @(
    '........................',
    '........................',
    '........................',
    '........................',
    '.........######.........',
    '.........#....#.........',
    '.........######.........',
    '..####################..',
    '..####################..',
    '..####################..',
    '..####################..',
    '..#########..#########..',
    '..#########..#########..',
    '..####################..',
    '..####################..',
    '..####################..',
    '..####################..',
    '..####################..',
    '..####################..',
    '..####################..',
    '..####################..',
    '........................',
    '........................',
    '........................'
)

# CALENDAR - two binder tabs + header bar + outlined month grid
$calendar = @(
    '........................',
    '........................',
    '.....###........###.....',
    '.....###........###.....',
    '...##################...',
    '...##################...',
    '...##################...',
    '...##################...',
    '...##################...',
    '...##..............##...',
    '...##..............##...',
    '...##..............##...',
    '...##..............##...',
    '...##..............##...',
    '...##..............##...',
    '...##..............##...',
    '...##..............##...',
    '...##..............##...',
    '...##..............##...',
    '...##..............##...',
    '...##################...',
    '........................',
    '........................',
    '........................'
)

# PERSON - circle head + shoulder dome
$person = @(
    '........................',
    '........................',
    '........................',
    '...........##...........',
    '..........####..........',
    '.........######.........',
    '........########........',
    '........########........',
    '.........######.........',
    '..........####..........',
    '...........##...........',
    '........................',
    '.......##########.......',
    '......############......',
    '.....##############.....',
    '....################....',
    '...##################...',
    '...##################...',
    '...##################...',
    '...##################...',
    '...##################...',
    '........................',
    '........................',
    '........................'
)

New-Icon 'home'      $homeArt
New-Icon 'briefcase' $briefcase
New-Icon 'calendar'  $calendar
New-Icon 'person'    $person

# --- Verification: PNG signature + structure ------------------------------------
$signature = [byte[]]@(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
foreach ($name in @('home', 'briefcase', 'calendar', 'person')) {
    $path = Join-Path $outDir "$name.png"
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $ok = $true
    for ($i = 0; $i -lt 8; $i++) { if ($bytes[$i] -ne $signature[$i]) { $ok = $false } }
    if (-not $ok) { throw "$name.png : INVALID PNG signature" }
    Write-Output ("verify {0}.png : PNG signature OK, {1} bytes" -f $name, $bytes.Length)
}
Write-Output 'DONE - all four icons generated and verified.'
