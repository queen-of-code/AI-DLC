#!/usr/bin/env bash
# Template: poll GitHub for AIDLC work and invoke Claude Code (macOS / launchd).
#
# Copy to your repo or ~/.local/bin; configure environment (see docs/GITHUB-AIDLC-PROJECT.md).
# Do not commit secrets. chmod +x after copy.
#
# Required env (example):
#   export GH_TOKEN=...          # fine-grained PAT or use gh auth login
#   export AIDLC_REPO=OWNER/REPO
#   export AIDLC_PHASE=plan      # plan | design | build | review | ship — must match your query
#
# Optional:
#   export AIDLC_REPO_ROOT=/path/to/clone
#   export CLAUDE_BIN=claude
#   export AIDLC_DRY_RUN=1       # print only

set -euo pipefail

: "${AIDLC_REPO:?Set AIDLC_REPO=OWNER/REPO}"
: "${AIDLC_PHASE:?Set AIDLC_PHASE=plan|design|build|review|ship}"

ROOT="${AIDLC_REPO_ROOT:-$HOME/Projects/$(echo "$AIDLC_REPO" | cut -d/ -f2)}"
CLAUDE="${CLAUDE_BIN:-claude}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROMPT_FILE="${AIDLC_PROMPT_FILE:-$SCRIPT_DIR/prompts/aidlc-phase-issue.md}"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "Missing prompt file: $PROMPT_FILE" >&2
  exit 1
fi

# --- Query: extend with REST (`gh api` projects/columns/cards) for GitHub Projects (classic)
#   column membership, or label filters, plus aidlc_work:unstarted. Projects (new) / v2 uses
#   GraphQL ProjectV2 if you are not on classic boards.
# Placeholders: list issues that have aidlc_work:unstarted and match the phase column.
# Example uses label + milestone — replace with your column query when wired:
echo "AIDLC cron: phase=$AIDLC_PHASE repo=$AIDLC_REPO (template — implement gh/REST query for classic columns here)" >&2

ISSUES="${AIDLC_ISSUES:-}"
if [[ -z "$ISSUES" ]]; then
  echo "No AIDLC_ISSUES set; exiting 0 (template). Set AIDLC_ISSUES='123 456' to test." >&2
  exit 0
fi

for ISSUE in $ISSUES; do
  if [[ "${AIDLC_DRY_RUN:-}" == "1" ]]; then
    echo "DRY RUN: would run Claude for issue #$ISSUE in $ROOT"
    continue
  fi

  if [[ ! -d "$ROOT" ]]; then
    echo "Clone $AIDLC_REPO to $ROOT first" >&2
    exit 1
  fi

  # Optional: mark in progress before long run
  gh issue edit "$ISSUE" --repo "$AIDLC_REPO" --add-label "aidlc_work:in_progress" 2>/dev/null || true
  gh issue edit "$ISSUE" --repo "$AIDLC_REPO" --remove-label "aidlc_work:unstarted" 2>/dev/null || true

  PROMPT=$(sed -e "s/{{ISSUE}}/$ISSUE/g" -e "s/{{PHASE}}/$AIDLC_PHASE/g" -e "s|{{REPO}}|$AIDLC_REPO|g" "$PROMPT_FILE")

  (cd "$ROOT" && "$CLAUDE" --print --dangerously-skip-permissions "$PROMPT") || {
    echo "Claude failed for issue #$ISSUE" >&2
    gh issue edit "$ISSUE" --repo "$AIDLC_REPO" --remove-label "aidlc_work:in_progress" 2>/dev/null || true
    gh issue edit "$ISSUE" --repo "$AIDLC_REPO" --add-label "aidlc_work:unstarted" 2>/dev/null || true
  }
done
