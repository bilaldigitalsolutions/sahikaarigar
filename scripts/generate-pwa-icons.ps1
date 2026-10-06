# =============================================================================
# Generates the PWA / social assets into `public/` using .NET GDI+ (Windows).
#   public/icons/icon-192.png       (manifest, 192x192)
#   public/icons/icon-512.png       (manifest, 512x512)
#   public/apple-touch-icon.png     (iOS home-screen, 180x180)
#   public/favicon.ico              (48x48 PNG wrapped in an ICO container)
#   public/og-image.png             (1200x630 social share card)
#
# Run:  powershell -ExecutionPolicy Bypass -File scripts/generate-pwa-icons.ps1
# =============================================================================

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root      = Split-Path -Parent $PSScriptRoot
$publicDir = Join-Path $root 'public'
$iconsDir  = Join-Path $publicDir 'icons'
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

$brand     = [System.Drawing.ColorTranslator]::FromHtml('#D84315')
$brandDark = [System.Drawing.ColorTranslator]::FromHtml('#BF360C')
$brandLite = [System.Drawing.ColorTranslator]::FromHtml('#FF7043')

function New-MonogramBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear($brand)
  $font = New-Object System.Drawing.Font('Segoe UI', [float]($size * 0.40), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $fmt  = New-Object System.Drawing.StringFormat
  $fmt.Alignment     = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
  $g.DrawString('SK', $font, [System.Drawing.Brushes]::White, $rect, $fmt)
  $g.Dispose()
  return $bmp
}

# --- Icons -------------------------------------------------------------------
$i192 = New-MonogramBitmap 192
$i192.Save((Join-Path $iconsDir 'icon-192.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$i192.Dispose()

$i512 = New-MonogramBitmap 512
$i512.Save((Join-Path $iconsDir 'icon-512.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$i512.Dispose()

$iApple = New-MonogramBitmap 180
$iApple.Save((Join-Path $publicDir 'apple-touch-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$iApple.Dispose()

# --- favicon.ico (48x48 PNG payload inside an ICO container) ------------------
$i48 = New-MonogramBitmap 48
$msPng = New-Object System.IO.MemoryStream
$i48.Save($msPng, [System.Drawing.Imaging.ImageFormat]::Png)
$i48.Dispose()
$pngBytes = $msPng.ToArray()
$msPng.Dispose()

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1)      # reserved, type=icon, count=1
$bw.Write([Byte]48);  $bw.Write([Byte]48)                             # width, height
$bw.Write([Byte]0);   $bw.Write([Byte]0)                              # palette, reserved
$bw.Write([UInt16]1); $bw.Write([UInt16]32)                           # planes, bit count
$bw.Write([UInt32]$pngBytes.Length)                                   # image size
$bw.Write([UInt32]22)                                                 # image offset
$bw.Write($pngBytes)
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $publicDir 'favicon.ico'), $ms.ToArray())
$bw.Dispose(); $ms.Dispose()

# --- og-image.png (1200x630 social card) -------------------------------------
$w = 1200; $h = 630
$og = New-Object System.Drawing.Bitmap($w, $h)
$g  = [System.Drawing.Graphics]::FromImage($og)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $brandDark, $brandLite, 35)
$g.FillRectangle($grad, $rect)

$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment     = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center

$titleFont = New-Object System.Drawing.Font('Segoe UI', [float]92, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('SahiKaarigar', $titleFont, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(0, 180, $w, 120)), $fmt)

$tagFont = New-Object System.Drawing.Font('Segoe UI', [float]40, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('Hyderabad ke Best Workers Dhundho', $tagFont, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(0, 320, $w, 70)), $fmt)

$subFont = New-Object System.Drawing.Font('Segoe UI', [float]28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString('Verified Electricians - Plumbers - Painters & more', $subFont, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF(0, 400, $w, 50)), $fmt)

$g.Dispose()
$og.Save((Join-Path $publicDir 'og-image.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$og.Dispose()

Write-Output 'Generated PWA assets:'
Get-ChildItem $publicDir -Recurse -File | ForEach-Object { "  $($_.FullName)  ($($_.Length) bytes)" }
