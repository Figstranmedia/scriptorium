#!/bin/bash
# Generates macOS .icns and Windows .ico from assets/icon.svg
# Requires: rsvg-convert (brew install librsvg) OR sips (built-in macOS)

set -e
cd "$(dirname "$0")/.."

SVG="assets/icon.svg"
ICONSET="build/icon.iconset"
PNG="build/icon.png"

echo "🎨 Generando iconos de Scriptorium..."

mkdir -p build "$ICONSET"

# Convert SVG → 1024px PNG using rsvg-convert or qlmanage
if command -v rsvg-convert &>/dev/null; then
  rsvg-convert -w 1024 -h 1024 "$SVG" -o "$PNG"
elif command -v inkscape &>/dev/null; then
  inkscape --export-filename="$PNG" -w 1024 -h 1024 "$SVG"
else
  # Fallback: use Safari/WebKit via qlmanage
  echo "⚠️  rsvg-convert no encontrado. Usando sips + Safari fallback..."
  # Copy SVG as PNG placeholder (sips can convert if we open in browser first)
  cp "$SVG" build/icon_src.svg
  # Use Python + PIL if available
  python3 -c "
import subprocess, os
# Try using cairosvg if available
try:
    import cairosvg
    cairosvg.svg2png(url='assets/icon.svg', write_to='build/icon.png', output_width=1024, output_height=1024)
    print('✓ Converted with cairosvg')
except ImportError:
    print('Installing cairosvg...')
    subprocess.run(['pip3', 'install', 'cairosvg', '--quiet'])
    import cairosvg
    cairosvg.svg2png(url='assets/icon.svg', write_to='build/icon.png', output_width=1024, output_height=1024)
    print('✓ Converted with cairosvg')
" 2>/dev/null || {
    echo "Usando sips para crear placeholder PNG..."
    # Create a basic PNG from SVG via sips
    sips -s format png "$SVG" --out "$PNG" 2>/dev/null || true
  }
fi

if [ ! -f "$PNG" ]; then
  echo "❌ No se pudo generar icon.png"
  exit 1
fi

echo "✓ icon.png generado ($(du -h "$PNG" | cut -f1))"

# Generate all required sizes for macOS iconset
sizes=(16 32 64 128 256 512 1024)
for size in "${sizes[@]}"; do
  sips -z $size $size "$PNG" --out "$ICONSET/icon_${size}x${size}.png" &>/dev/null
  # Retina (@2x) versions
  half=$((size / 2))
  if [ $half -ge 16 ]; then
    cp "$ICONSET/icon_${size}x${size}.png" "$ICONSET/icon_${half}x${half}@2x.png"
  fi
done

# Also copy main sizes with standard names
cp "$ICONSET/icon_16x16.png" "$ICONSET/icon_16x16.png"
cp "$ICONSET/icon_32x32.png" "$ICONSET/icon_32x32.png"

# Build .icns
iconutil -c icns "$ICONSET" -o "build/icon.icns"
echo "✓ icon.icns generado"

# Also keep icon.png at build/ for electron-builder
cp "$PNG" "build/icon.png"

echo ""
echo "✅ Iconos listos:"
ls -lh build/icon.*
