Add-Type -AssemblyName System.Drawing

$src = "c:\Users\Bugra\Documents\github_proje\componentInventory\src-tauri\icons\source_1024.png"
$dir = "c:\Users\Bugra\Documents\github_proje\componentInventory\src-tauri\icons"

$source = [System.Drawing.Image]::FromFile($src)

function Resize-Image($img, $w, $h) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $w, $h)
    $g.Dispose()
    return $bmp
}

# PNG variants
$sizes = @(
    @{ File="32x32.png";     W=32;  H=32  },
    @{ File="128x128.png";   W=128; H=128 },
    @{ File="128x128@2x.png"; W=256; H=256 }
)

foreach ($s in $sizes) {
    $bmp = Resize-Image $source $s.W $s.H
    $out = Join-Path $dir $s.File
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Saved $($s.File)"
}

# ICO file (multi-resolution: 16, 32, 48, 64, 128, 256)
$icoSizes   = @(16, 32, 48, 64, 128, 256)
$icoImages  = @()
foreach ($sz in $icoSizes) {
    $icoImages += Resize-Image $source $sz $sz
}

$icoPath = Join-Path $dir "icon.ico"
$ms      = New-Object System.IO.MemoryStream

# ICO header: ICONDIR
$writer = New-Object System.IO.BinaryWriter($ms)
$writer.Write([uint16]0)          # reserved
$writer.Write([uint16]1)          # type: ICO
$writer.Write([uint16]$icoImages.Count)

# Write ICONDIRENTRY stubs (placeholder offsets)
$imageDataStreams = @()
foreach ($img in $icoImages) {
    $pngMs = New-Object System.IO.MemoryStream
    $img.Save($pngMs, [System.Drawing.Imaging.ImageFormat]::Png)
    $imageDataStreams += $pngMs
}

# Calculate offsets
# Header = 6 bytes, each ICONDIRENTRY = 16 bytes
$headerSize = 6 + 16 * $icoImages.Count
$offsets = @()
$offset  = $headerSize
foreach ($pms in $imageDataStreams) {
    $offsets += $offset
    $offset  += $pms.Length
}

# Write entries
for ($i = 0; $i -lt $icoImages.Count; $i++) {
    $sz  = $icoSizes[$i]
    $pms = $imageDataStreams[$i]
    $w   = if ($sz -eq 256) { 0 } else { $sz }
    $h   = if ($sz -eq 256) { 0 } else { $sz }
    $writer.Write([byte]$w)
    $writer.Write([byte]$h)
    $writer.Write([byte]0)   # color count
    $writer.Write([byte]0)   # reserved
    $writer.Write([uint16]1) # color planes
    $writer.Write([uint16]32) # bits per pixel
    $writer.Write([uint32]$pms.Length)
    $writer.Write([uint32]$offsets[$i])
}

# Write image data
foreach ($pms in $imageDataStreams) {
    $writer.Write($pms.ToArray())
    $pms.Dispose()
}

$writer.Flush()

[System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
$ms.Dispose()
Write-Host "Saved icon.ico ($($icoSizes.Count) sizes embedded)"

# Cleanup
$source.Dispose()
foreach ($img in $icoImages) { $img.Dispose() }

Write-Host "All icons generated successfully."
