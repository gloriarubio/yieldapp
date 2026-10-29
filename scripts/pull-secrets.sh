#!/usr/bin/env bash
# Regenera los archivos de secretos del proyecto desde Bitwarden (notas seguras).
#
# Requisitos: Bitwarden CLI (npm i -g @bitwarden/cli), sesión iniciada y desbloqueada:
#   bw config server https://vault.bitwarden.eu && bw login
#   export BW_SESSION="$(bw unlock --raw)"        # PowerShell: $env:BW_SESSION = (bw unlock --raw)
#
# Uso (desde la raíz del repo, en Git Bash):  ./scripts/pull-secrets.sh
set -euo pipefail

REPO="yieldapp"
FILES=(
  ".env.local"
)

cd "$(dirname "$0")/.."

if ! command -v bw >/dev/null 2>&1; then
  echo "ERROR: no está instalada la CLI de Bitwarden. Instálala con: npm i -g @bitwarden/cli" >&2
  exit 1
fi
if ! bw status --nointeraction 2>/dev/null | grep -q '"status":"unlocked"'; then
  echo "ERROR: Bitwarden no está desbloqueado. Ejecuta: export BW_SESSION=\"\$(bw unlock --raw)\"" >&2
  exit 1
fi

bw sync --nointeraction >/dev/null
for f in "${FILES[@]}"; do
  tmp="$(mktemp)"
  if ! bw get notes "dev/$REPO/$f" --nointeraction > "$tmp" 2>/dev/null || [ ! -s "$tmp" ]; then
    rm -f "$tmp"
    echo "ERROR: no encuentro la nota «dev/$REPO/$f» en Bitwarden" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$f")"
  mv "$tmp" "$f"
  echo "ok  $f"
done
echo "Secretos regenerados."
