#!/usr/bin/env bash
#
# aidlc-doctor.sh — conformance check for the AIDLC local transport (OpenCode + self-hosted LLMs).
# Standalone: needs no daemon. Run from the consumer repo root in the AGENT shell (the one that
# runs `opencode`), with the variables from .env.example exported.
#
# Usage: aidlc-doctor.sh [--repo DIR] [--skip-llm] [--e2e]
#   --repo DIR   consumer repo root (default: .)
#   --skip-llm   skip the endpoint, model, and tool-call checks
#   --e2e        also run one real `opencode run` through aidlc-runner
#
# Exit status: 0 when there are no FAILs (WARNs are allowed), 1 otherwise.

set -u

REPO="."
SKIP_LLM=0
E2E=0
PHASES="plan design build review ship learn"
REVIEWERS="tech-spec testing devops frontend-ux security architectural-soundness"
PLANNERS="researcher product-manager product-marketer grounding-reviewer clarity-reviewer"
FAILS=0
WARNS=0

while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --skip-llm) SKIP_LLM=1; shift ;;
    --e2e) E2E=1; shift ;;
    -h|--help) sed -n '3,13p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1 (try --help)" >&2; exit 2 ;;
  esac
done

pass() { printf '  \033[0;32mPASS\033[0m %s\n' "$1"; }
warn() { printf '  \033[1;33mWARN\033[0m %s\n' "$1"; WARNS=$((WARNS + 1)); }
fail() { printf '  \033[0;31mFAIL\033[0m %s\n' "$1"; FAILS=$((FAILS + 1)); }
section() { printf '\n%s\n' "$1"; }

# Run a command with a timeout (macOS has no `timeout`). Output goes to stdout.
with_timeout() {
  local secs="$1"; shift
  local out; out=$(mktemp)
  "$@" >"$out" 2>&1 &
  local pid=$! i=0
  while kill -0 "$pid" 2>/dev/null && [ "$i" -lt "$secs" ]; do sleep 1; i=$((i + 1)); done
  if kill -0 "$pid" 2>/dev/null; then kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; cat "$out"; rm -f "$out"; return 124; fi
  wait "$pid"; local rc=$?
  cat "$out"; rm -f "$out"; return "$rc"
}

cd "$REPO" || { echo "No such repo dir: $REPO" >&2; exit 2; }
CONFIG="opencode.jsonc"

section "Tools"
for t in opencode git curl jq; do
  if command -v "$t" >/dev/null 2>&1; then pass "$t found"; else fail "$t not installed"; fi
done
command -v opencode >/dev/null 2>&1 && pass "opencode $(opencode --version 2>/dev/null)"
command -v gh >/dev/null 2>&1 || warn "gh not installed (needed by Build/Review)"

section "Config ($CONFIG)"
CFG_JSON=""
if [ ! -f "$CONFIG" ]; then
  fail "$CONFIG missing at repo root (copy from AI-DLC docs/templates/aidlc-local/opencode/)"
else
  CFG_JSON=$(grep -v '^[[:space:]]*//' "$CONFIG" | jq -c . 2>/dev/null)
  if [ -z "$CFG_JSON" ]; then
    fail "$CONFIG does not parse (keep comments full-line and no trailing commas)"
  else
    pass "$CONFIG parses"
    if grep -q 'CHANGE-ME' "$CONFIG"; then fail "model IDs still CHANGE-ME placeholders"; else pass "model IDs set"; fi
    STRONG=$(echo "$CFG_JSON" | jq -r '.providers.local.models["aidlc-strong"].modelID // empty')
    WORK=$(echo "$CFG_JSON" | jq -r '.providers.local.models["aidlc-workhorse"].modelID // empty')
    [ -n "$STRONG" ] && [ -n "$WORK" ] && pass "local tiers: strong=$STRONG workhorse=$WORK" || fail "providers.local.models aidlc-strong / aidlc-workhorse missing"

    # No-egress (invariant §2.6): deny every provider, allow only `local`.
    DENY_ALL=$(echo "$CFG_JSON" | jq '[.policies[]? | select(.action=="provider.use" and .resource=="*" and .effect=="deny")] | length')
    OTHER_ALLOW=$(echo "$CFG_JSON" | jq -r '[.policies[]? | select(.action=="provider.use" and .effect=="allow" and .resource!="local") | .resource] | join(",")')
    [ "$DENY_ALL" -ge 1 ] && pass "policies deny provider.use *" || fail "no policy denying provider.use * (cloud models reachable)"
    [ -z "$OTHER_ALLOW" ] && pass "only the local provider is allowed" || fail "policies also allow: $OTHER_ALLOW"

    if echo "$CFG_JSON" | jq -e 'has("skills")' >/dev/null; then
      warn "\"skills\" entries outrank .opencode/skills — make sure none of them shadows the phase overrides"
    else
      pass "no \"skills\" entries shadowing the overrides"
    fi
    if grep -Eq 'AIDLC_LINEAR_DAEMON_KEY|AIDLC_GH_READ_TOKEN' "$CONFIG"; then
      fail "$CONFIG references a daemon-only secret (the agent must never get the full key)"
    else
      pass "no daemon-only secrets referenced"
    fi
    first=$(echo "$CFG_JSON" | jq -r '.agents["aidlc-runner"].permissions[0] | "\(.action) \(.resource) \(.effect)"' 2>/dev/null)
    [ "$first" = "* * deny" ] && pass "aidlc-runner starts deny-all (no headless ask)" || fail "aidlc-runner permissions must start with { * * deny }"
    merge=$(echo "$CFG_JSON" | jq -r '[.agents["aidlc-runner"].permissions[] | select(.action=="shell" and .resource=="gh pr merge *")] | last | .effect // "none"')
    [ "$merge" = "deny" ] && pass "aidlc-runner denies gh pr merge" || fail "aidlc-runner does not deny gh pr merge"
    for g in aidlc-plan aidlc-review; do
      sub=$(echo "$CFG_JSON" | jq -r --arg r "$g/*" '[.agents["aidlc-runner"].permissions[] | select(.action=="subagent" and .resource==$r)] | last | .effect // "none"')
      [ "$sub" = "allow" ] && pass "aidlc-runner may start $g/* subagents" || fail "aidlc-runner cannot start $g/* subagents"
    done
    # save_issue creates AND updates issues (state, delegate, assignee) — the self-approval path.
    # No rule anywhere may allow it, directly or by wildcard; slices are created by aidlc-slices.sh.
    SAVE_ALLOWS=$(echo "$CFG_JSON" | jq -r '[.permissions[]?, (.agents[]?.permissions[]?)
      | select(.effect == "allow" and (.action as $a | "linear_save_issue" | test("^" + ($a | gsub("\\*"; ".*")) + "$")))
      | .action] | unique | join(", ")')
    [ -z "$SAVE_ALLOWS" ] && pass "no agent can call linear_save_issue" || fail "$CONFIG allows linear_save_issue via: $SAVE_ALLOWS"
  fi
fi

section "Layout"
for p in $PHASES; do
  [ -f ".claude/skills/$p/SKILL.md" ] || fail ".claude/skills/$p/SKILL.md missing (AI-DLC submodule symlink)"
  [ -f ".opencode/skills/$p/SKILL.md" ] || fail ".opencode/skills/$p/SKILL.md missing (local override)"
  [ -f ".opencode/commands/aidlc/$p.md" ] || fail ".opencode/commands/aidlc/$p.md missing"
done
[ -f ".opencode/skills/aidlc-local/SKILL.md" ] || fail ".opencode/skills/aidlc-local/SKILL.md missing"
for r in $REVIEWERS; do
  [ -f ".opencode/agents/aidlc-review/$r.md" ] || fail ".opencode/agents/aidlc-review/$r.md missing"
done
for r in $PLANNERS; do
  [ -f ".opencode/agents/aidlc-plan/$r.md" ] || fail ".opencode/agents/aidlc-plan/$r.md missing"
done
if [ -d .opencode/agents ] && grep -rEq 'action: *"?linear_(save_issue|save_\*|\*)"?.*effect: *allow' .opencode/agents; then
  fail "an agent file in .opencode/agents allows linear_save_issue"
fi
command -v aidlc-slices.sh >/dev/null 2>&1 || [ -x scripts/aidlc-slices.sh ] \
  || warn "aidlc-slices.sh not found (scripts/ or PATH) — you need it to create slices after the Design gate"
[ -f docs/AIDLC.md ] && pass "docs/AIDLC.md present" || fail "docs/AIDLC.md missing (copy AI-DLC docs/templates/AIDLC.md)"
if [ -f AGENTS.md ] && grep -q 'Issue tracker (AIDLC)' AGENTS.md; then
  pass "AGENTS.md has Issue tracker (AIDLC)"
  grep -q 'Privilege' AGENTS.md && pass "AGENTS.md declares Privilege" || fail "AGENTS.md tracker table has no Privilege row"
  grep -q 'Validation target' AGENTS.md && pass "AGENTS.md declares Validation target" || warn "AGENTS.md has no Validation target block (needed by /aidlc/ship)"
else
  fail "AGENTS.md missing an Issue tracker (AIDLC) section"
fi
[ "$FAILS" -eq 0 ] && pass "layout complete"

section "Agents load"
if command -v opencode >/dev/null 2>&1 && [ -n "$CFG_JSON" ]; then
  AGENTS=$(with_timeout 60 opencode debug agents --standalone)
  if [ -z "$AGENTS" ]; then
    fail "opencode debug agents returned nothing"
  else
    echo "$AGENTS" | grep -q '"id": "aidlc-runner"' && pass "aidlc-runner loaded" || fail "aidlc-runner not loaded"
    n=$(echo "$AGENTS" | grep -c '"id": "aidlc-review/')
    [ "$n" -eq 6 ] && pass "6 review subagents loaded" || fail "$n of 6 review subagents loaded"
    n=$(echo "$AGENTS" | grep -c '"id": "aidlc-plan/')
    [ "$n" -eq 5 ] && pass "5 plan subagents loaded" || fail "$n of 5 plan subagents loaded"
  fi
fi

section "Environment (agent shell)"
[ -n "${AIDLC_LLM_BASE_URL:-}" ] && pass "AIDLC_LLM_BASE_URL=$AIDLC_LLM_BASE_URL" || fail "AIDLC_LLM_BASE_URL not set"
[ -n "${AIDLC_LINEAR_AGENT_KEY:-}" ] && pass "AIDLC_LINEAR_AGENT_KEY set" || fail "AIDLC_LINEAR_AGENT_KEY not set"
if [ -n "${AIDLC_LINEAR_DAEMON_KEY:-}" ]; then
  if [ "${AIDLC_LINEAR_DAEMON_KEY}" = "${AIDLC_LINEAR_AGENT_KEY:-}" ]; then
    fail "agent and daemon Linear keys are the same key (separate keys = kill switch)"
  else
    warn "AIDLC_LINEAR_DAEMON_KEY is visible in this shell — the agent must never inherit it"
  fi
fi
[ -n "${AIDLC_GH_READ_TOKEN:-}" ] && warn "AIDLC_GH_READ_TOKEN is visible in this shell (daemon-only)"

if [ "$SKIP_LLM" -eq 0 ] && [ -n "${AIDLC_LLM_BASE_URL:-}" ]; then
  section "Local model endpoint"
  MODELS=$(curl -s -m 10 "$AIDLC_LLM_BASE_URL/models")
  if ! echo "$MODELS" | jq -e '.data' >/dev/null 2>&1; then
    fail "no model list at $AIDLC_LLM_BASE_URL/models"
  else
    pass "endpoint reachable"
    for m in $(printf '%s\n' ${STRONG:-} ${WORK:-} | sort -u); do
      echo "$MODELS" | jq -e --arg m "$m" '.data[] | select(.id==$m)' >/dev/null && pass "model served: $m" || fail "model not served: $m"
    done
    # Tool-call smoke test: discovery cannot tell you whether tools work, only a call can.
    for m in $(printf '%s\n' ${STRONG:-} ${WORK:-} | sort -u); do
      BODY=$(jq -nc --arg m "$m" '{model:$m, temperature:0, max_tokens:256,
        messages:[{role:"user",content:"Call the get_magic_number tool with name set to aidlc. Do not answer in text."}],
        tools:[{type:"function",function:{name:"get_magic_number",description:"Returns a magic number",
          parameters:{type:"object",properties:{name:{type:"string"}},required:["name"]}}}]}')
      RESP=$(curl -s -m 240 -H 'Content-Type: application/json' -d "$BODY" "$AIDLC_LLM_BASE_URL/chat/completions")
      called=$(echo "$RESP" | jq -r '.choices[0].message.tool_calls[0].function.name // empty' 2>/dev/null)
      [ "$called" = "get_magic_number" ] && pass "tool calling works: $m" || fail "tool calling failed for $m (server tool parser / chat template?)"
    done
  fi
fi

section "Linear"
if [ -n "${AIDLC_LINEAR_AGENT_KEY:-}" ]; then
  WHO=$(curl -s -m 15 https://api.linear.app/graphql -H 'Content-Type: application/json' \
    -H "Authorization: $AIDLC_LINEAR_AGENT_KEY" -d '{"query":"{ viewer { name email } }"}' | jq -r '.data.viewer.name // empty')
  [ -n "$WHO" ] && pass "agent key authenticates as: $WHO (should be the bot member)" || fail "agent key rejected by Linear"
fi
warn "key scope is not checked here — confirm the agent key cannot move state (plan §10.1)"

section "GitHub"
if command -v gh >/dev/null 2>&1; then
  LOGIN=$(gh api user --jq .login 2>/dev/null)
  if [ -z "$LOGIN" ]; then
    warn "gh not authenticated"
  elif [ -n "${AIDLC_GH_BOT_LOGIN:-}" ] && [ "$LOGIN" != "$AIDLC_GH_BOT_LOGIN" ]; then
    fail "gh is authenticated as $LOGIN, expected bot $AIDLC_GH_BOT_LOGIN"
  else
    pass "gh authenticated as $LOGIN"
  fi
  NWO=$(gh repo view --json nameWithOwner,defaultBranchRef --jq '.nameWithOwner + " " + .defaultBranchRef.name' 2>/dev/null)
  if [ -n "$NWO" ]; then
    set -- $NWO
    REVIEWS=$(gh api "repos/$1/branches/$2/protection" --jq '.required_pull_request_reviews.required_approving_review_count // 0' 2>/dev/null)
    if [ -z "$REVIEWS" ]; then
      warn "cannot read branch protection on $1@$2 (needs admin) — confirm a required human review"
    elif [ "$REVIEWS" -ge 1 ]; then
      pass "branch protection requires $REVIEWS review(s) on $2"
    else
      fail "branch protection on $2 requires no review (the bot could merge)"
    fi
  fi
fi

section "Hooks"
[ -f .pre-commit-config.yaml ] && pass ".pre-commit-config.yaml present" || warn "no .pre-commit-config.yaml (fast inner-loop checks)"
[ -f .git/hooks/pre-commit ] && pass "pre-commit hook installed" || warn "no .git/hooks/pre-commit (run: pre-commit install)"

if [ "$E2E" -eq 1 ] && [ "$FAILS" -eq 0 ]; then
  section "End to end"
  OUT=$(with_timeout 300 opencode run --standalone --agent aidlc-runner -m local/aidlc-workhorse "Reply with exactly: OK")
  echo "$OUT" | grep -qx 'OK' && pass "opencode run through aidlc-runner answered" || fail "opencode run did not answer OK: $(echo "$OUT" | tail -1)"
fi

printf '\n%s FAIL, %s WARN\n' "$FAILS" "$WARNS"
[ "$FAILS" -eq 0 ]
