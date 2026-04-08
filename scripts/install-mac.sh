#!/bin/bash
# Auto-install Scriptorium to /Applications after each build
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  SRC="dist-app/mac-arm64/Scriptorium.app"
else
  SRC="dist-app/mac/Scriptorium.app"
fi

if [ -d "$SRC" ]; then
  rm -rf /Applications/Scriptorium.app
  cp -r "$SRC" /Applications/Scriptorium.app
  echo "✓ Scriptorium instalado en /Applications ($ARCH)"
else
  echo "✗ No se encontró la app compilada en $SRC"
  exit 1
fi
