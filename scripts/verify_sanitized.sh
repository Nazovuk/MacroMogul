#!/usr/bin/env bash
set -e

echo "======================================="
echo " MACROMOGUL REPO SANITIZATION CHECK"
echo "======================================="

echo
echo "1) Checking legacy project names (tracked files)..."
LEGACY=$(git grep -nE "capitalism-lab-clone|capitalism-clone" || true)
if [ -z "$LEGACY" ]; then
  echo "OK: No legacy project names in tracked files."
else
  echo "FOUND LEGACY NAMES:"
  echo "$LEGACY"
  exit 1
fi

echo
echo "2) Checking forbidden UI labels: Close / close..."
CLOSE_CHECK=$(git grep -nE "\"Close\"|'Close'|>Close<|>close<|\"close\"|'close'" || true)
if [ -z "$CLOSE_CHECK" ]; then
  echo "OK: No visible Close/close labels."
else
  echo "FOUND UI CLOSE LABELS:"
  echo "$CLOSE_CHECK"
  exit 1
fi

echo
echo "3) Checking file/folder names containing 'capitalism'..."
FILES=$(find . -type f -name "*capitalism*" -not -path "./node_modules/*")
DIRS=$(find . -type d -name "*capitalism*" -not -path "./node_modules/*")

if [ -z "$FILES" ] && [ -z "$DIRS" ]; then
  echo "OK: No filenames or directories with 'capitalism'."
else
  echo "FOUND FILES/DIRS WITH 'capitalism':"
  echo "$FILES"
  echo "$DIRS"
  exit 1
fi

echo
echo "4) Checking index.html title..."
TITLE=$(grep -n "<title>" index.html || true)
if echo "$TITLE" | grep -q "MacroMogul"; then
  echo "OK: Title is MacroMogul."
else
  echo "WARNING: Title may not be MacroMogul:"
  echo "$TITLE"
fi

echo
echo "5) Checking package.json name..."
PKG=$(grep -n '"name":' package.json || true)
if echo "$PKG" | grep -qi "macromogul"; then
  echo "OK: package.json name is correct."
else
  echo "WARNING: package.json name not macromogul:"
  echo "$PKG"
fi

echo
echo "6) Checking .antigravity rules existence..."
if [ -d ".antigravity" ]; then
  echo "OK: .antigravity folder exists."
else
  echo "WARNING: .antigravity folder missing."
fi

echo
echo "======================================="
echo " FINAL RESULT: REPO IS CLEAN (MacroMogul)"
echo "======================================="
