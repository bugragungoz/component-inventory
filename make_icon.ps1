Add-Type -AssemblyName System.Drawing

$size = 1024
$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$g.Clear([System.Drawing.Color]::Transparent)

$accentColor  = [System.Drawing.Color]::FromArgb(255, 217, 119, 87)
$bgColor      = [System.Drawing.Color]::FromArgb(255, 26,  25,  22)
$chipColor    = [System.Drawing.Color]::FromArgb(255, 42,  40,  36)
$pinColor     = [System.Drawing.Color]::FromArgb(255, 185, 105, 75)

$bgBrush      = New-Object System.Drawing.SolidBrush($bgColor)
$accentBrush  = New-Object System.Drawing.SolidBrush($accentColor)
$chipBrush    = New-Object System.Drawing.SolidBrush($chipColor)
$pinBrush     = New-Object System.Drawing.SolidBrush($pinColor)
$accentPen    = New-Object System.Drawing.Pen($accentColor, 9)

# Outer rounded rect background
$cornerR = 180
$bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$bgPath.AddArc(24,              24,              $cornerR, $cornerR, 180, 90)
$bgPath.AddArc($size-24-$cornerR, 24,              $cornerR, $cornerR, 270, 90)
$bgPath.AddArc($size-24-$cornerR, $size-24-$cornerR, $cornerR, $cornerR, 0,   90)
$bgPath.AddArc(24,              $size-24-$cornerR, $cornerR, $cornerR, 90,  90)
$bgPath.CloseFigure()
$g.FillPath($bgBrush, $bgPath)

# Chip body
$cSize = 430
$cX    = ($size - $cSize) / 2
$cY    = ($size - $cSize) / 2
$cr    = 48
$chipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$chipPath.AddArc($cX,              $cY,              $cr, $cr, 180, 90)
$chipPath.AddArc($cX+$cSize-$cr,   $cY,              $cr, $cr, 270, 90)
$chipPath.AddArc($cX+$cSize-$cr,   $cY+$cSize-$cr,   $cr, $cr, 0,   90)
$chipPath.AddArc($cX,              $cY+$cSize-$cr,   $cr, $cr, 90,  90)
$chipPath.CloseFigure()
$g.FillPath($chipBrush, $chipPath)
$g.DrawPath($accentPen, $chipPath)

# Pins (4 per side)
$pinW    = 20
$pinLen  = 72
$pinGap  = 84
$pStart  = ($cSize - (4*$pinW + 3*($pinGap-$pinW))) / 2

for ($i = 0; $i -lt 4; $i++) {
    $off = $pStart + $i * $pinGap
    # Top
    $g.FillRectangle($pinBrush, [int]($cX+$off), [int]($cY-$pinLen), $pinW, $pinLen)
    # Bottom
    $g.FillRectangle($pinBrush, [int]($cX+$off), [int]($cY+$cSize),  $pinW, $pinLen)
    # Left
    $g.FillRectangle($pinBrush, [int]($cX-$pinLen), [int]($cY+$off), $pinLen, $pinW)
    # Right
    $g.FillRectangle($pinBrush, [int]($cX+$cSize),  [int]($cY+$off), $pinLen, $pinW)
}

# Notch (orientation mark)
$notchBrush = New-Object System.Drawing.SolidBrush($bgColor)
$g.FillEllipse($notchBrush, [int]($cX+18), [int]($cY+18), 50, 50)

# Circuit trace lines inside chip
$tracePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 217, 119, 87), 4)
$g.DrawLine($tracePen, [int]($cX+80),  [int]($cY+120), [int]($cX+180), [int]($cY+120))
$g.DrawLine($tracePen, [int]($cX+80),  [int]($cY+120), [int]($cX+80),  [int]($cY+190))
$g.DrawLine($tracePen, [int]($cX+$cSize-80), [int]($cY+120), [int]($cX+$cSize-180), [int]($cY+120))
$g.DrawLine($tracePen, [int]($cX+$cSize-80), [int]($cY+120), [int]($cX+$cSize-80),  [int]($cY+190))
$g.DrawLine($tracePen, [int]($cX+80),  [int]($cY+$cSize-80), [int]($cX+80),  [int]($cY+$cSize-150))
$g.DrawLine($tracePen, [int]($cX+$cSize-80), [int]($cY+$cSize-80), [int]($cX+$cSize-80), [int]($cY+$cSize-150))

# "CI" text
$font = New-Object System.Drawing.Font("Arial", 148, [System.Drawing.FontStyle]::Bold)
$sf   = New-Object System.Drawing.StringFormat
$sf.Alignment     = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$textRect = New-Object System.Drawing.RectangleF($cX, ($cY+30), $cSize, ($cSize-30))
$g.DrawString("CI", $font, $accentBrush, $textRect, $sf)

# Corner accent dots
$dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(55, 217, 119, 87))
foreach ($dx in @(90, 140, 190)) {
    foreach ($dy in @(90, 140, 190)) {
        $g.FillEllipse($dotBrush, $dx,       $dy,       14, 14)
        $g.FillEllipse($dotBrush, $size-$dx-14, $dy,    14, 14)
        $g.FillEllipse($dotBrush, $dx,       $size-$dy-14, 14, 14)
        $g.FillEllipse($dotBrush, $size-$dx-14, $size-$dy-14, 14, 14)
    }
}

$g.Dispose()
$out = "c:\Users\Bugra\Documents\github_proje\componentInventory\src-tauri\icons\source_1024.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Saved: $out"
