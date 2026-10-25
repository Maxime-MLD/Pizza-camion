Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function New-PlaceholderPng {
  param(
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [Parameter(Mandatory = $true)][int]$Width,
    [Parameter(Mandatory = $true)][int]$Height,
    [Parameter(Mandatory = $true)][string]$AssetLabel
  )

  $outputPath = Join-Path $projectRoot $RelativePath
  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $background = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(23, 23, 23))
  $foreground = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(250, 250, 250))
  $muted = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(180, 180, 180))
  $border = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(115, 115, 115), [Math]::Max(1, $Width / 300))
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center

  try {
    $graphics.FillRectangle($background, 0, 0, $Width, $Height)
    $inset = [Math]::Max(2, [Math]::Round([Math]::Min($Width, $Height) * 0.06))
    $graphics.DrawRectangle($border, $inset, $inset, $Width - (2 * $inset), $Height - (2 * $inset))

    if ($Width -le 40) {
      $font = [System.Drawing.Font]::new("Arial", 7, [System.Drawing.FontStyle]::Bold)
      try {
        $graphics.DrawString("TODO", $font, $foreground, [System.Drawing.RectangleF]::new(0, 0, $Width, $Height), $format)
      }
      finally {
        $font.Dispose()
      }
    }
    else {
      $titleSize = [Math]::Max(18, [Math]::Round($Width / 14))
      $bodySize = [Math]::Max(10, [Math]::Round($Width / 32))
      $labelSize = [Math]::Max(8, [Math]::Round($Width / 52))
      $titleFont = [System.Drawing.Font]::new("Arial", $titleSize, [System.Drawing.FontStyle]::Bold)
      $bodyFont = [System.Drawing.Font]::new("Arial", $bodySize, [System.Drawing.FontStyle]::Regular)
      $labelFont = [System.Drawing.Font]::new("Arial", $labelSize, [System.Drawing.FontStyle]::Regular)
      try {
        $graphics.DrawString("TODO", $titleFont, $foreground, [System.Drawing.RectangleF]::new(0, $Height * 0.16, $Width, $Height * 0.28), $format)
        $graphics.DrawString("REPLACE CLIENT ASSET", $bodyFont, $foreground, [System.Drawing.RectangleF]::new(0, $Height * 0.42, $Width, $Height * 0.20), $format)
        $graphics.DrawString($AssetLabel, $labelFont, $muted, [System.Drawing.RectangleF]::new(0, $Height * 0.66, $Width, $Height * 0.12), $format)
      }
      finally {
        $titleFont.Dispose()
        $bodyFont.Dispose()
        $labelFont.Dispose()
      }
    }

    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $format.Dispose()
    $border.Dispose()
    $muted.Dispose()
    $foreground.Dispose()
    $background.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

New-PlaceholderPng "public\social\TODO_REPLACE_CLIENT_OG.png" 1200 630 "OPEN GRAPH - 1200 x 630"
New-PlaceholderPng "public\social\TODO_REPLACE_CLIENT_TWITTER.png" 1200 630 "SOCIAL / TWITTER - 1200 x 630"
New-PlaceholderPng "public\icons\TODO_REPLACE_CLIENT_FAVICON_32.png" 32 32 "FAVICON"
New-PlaceholderPng "public\icons\TODO_REPLACE_CLIENT_APPLE_TOUCH_ICON.png" 180 180 "APPLE TOUCH - 180 x 180"
New-PlaceholderPng "public\icons\TODO_REPLACE_CLIENT_ICON_192.png" 192 192 "MANIFEST - 192 x 192"
New-PlaceholderPng "public\icons\TODO_REPLACE_CLIENT_ICON_512.png" 512 512 "MANIFEST - 512 x 512"
