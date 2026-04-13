#!/usr/bin/env bash
# Keep plugins/ai-dlc-skills/skills/ identical to skills/ (Claude Code copies plugins to a
# cache; symlinks to ../../skills break — see docs/CLAUDE-MARKETPLACE.md).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/skills/"
DST="${ROOT}/plugins/ai-dlc-skills/skills/"
# Match tracked corpus: skills/external/ is gitignored; omit caches.
RSYNC_EXCLUDES=(
  --exclude=external/
  --exclude=__pycache__/
  --exclude='*.pyc'
  --exclude='*.zip'
)

usage() {
  echo "Usage: $0 [--check | --sync]" >&2
  echo "  --sync  Copy skills/ into plugins/ai-dlc-skills/skills/ (default)" >&2
  echo "  --check Exit 1 if the plugin copy is out of sync with skills/" >&2
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--check" ]]; then
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  rsync -a --delete "${RSYNC_EXCLUDES[@]}" "${SRC}" "${TMP}/"
  if ! diff -rq "${DST}" "${TMP}"; then
    echo "ERROR: plugins/ai-dlc-skills/skills is out of sync with skills/" >&2
    echo "Run: $0 --sync" >&2
    exit 1
  fi
  echo "OK: plugin skills match skills/"
  exit 0
fi

if [[ -n "${1:-}" && "${1}" != "--sync" ]]; then
  usage
  exit 1
fi

mkdir -p "${DST}"
rsync -a --delete "${RSYNC_EXCLUDES[@]}" "${SRC}" "${DST}"
echo "Synced skills/ -> plugins/ai-dlc-skills/skills/"
