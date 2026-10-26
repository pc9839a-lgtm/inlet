#!/usr/bin/env bash
set -euo pipefail

if fc-match "Noto Sans CJK KR" | grep -q 'NotoSansCJK'; then
  echo 'Korean browser font already available.'
  exit 0
fi

# CI evidence must contain readable Korean. Use the same font on every runner,
# without relying on package-manager mirrors or silently accepting missing glyphs.
font_dir="${XDG_DATA_HOME:-$HOME/.local/share}/fonts/pagero-qa"
font_file="$font_dir/NotoSansCJKkr-Regular.otf"
download_file="$font_file.part"
mkdir -p "$font_dir"
curl --fail --location --silent --show-error --retry 2 --connect-timeout 10 --max-time 90 \
  'https://raw.githubusercontent.com/notofonts/noto-cjk/523d033d6cb47f4a80c58a35753646f5c3608a78/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf' \
  --output "$download_file"
printf '%s  %s\n' '6bcb2a0703aa137e874fc2dffa85f6c21ba9a67fa329e81b8c801663af7e992a' "$download_file" | sha256sum --check --status
mv -- "$download_file" "$font_file"
fc-cache -f "$font_dir"
fc-match "Noto Sans CJK KR" | grep 'NotoSansCJK'
