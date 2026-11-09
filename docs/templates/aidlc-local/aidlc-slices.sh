#!/usr/bin/env bash
#
# aidlc-slices.sh — create a Feature's slice sub-issues from the `aidlc-slices` block in its
# Tech Spec Document, AFTER the human has moved the Feature to Build+Test.
#
# Design never creates issues (no agent holds an issue-write tool); this is the human-held step
# (P1). In P2 the daemon does the same thing on the gate event. Run it in YOUR shell with the
# full Linear key — never from an agent.
#
# Usage:
#   aidlc-slices.sh ENG-123 [--dry-run] [--build-state NAME] [--backlog-state NAME]
#   aidlc-slices.sh --plan-file tech-spec.md      # lint a slice plan offline, no Linear calls
#
#   --build-state NAME    state that means "gated" (default: Build+Test)
#   --backlog-state NAME  state new slices start in (default: the team's first backlog state)
#   --dry-run             show what would be created, change nothing
#
# Env: AIDLC_LINEAR_DAEMON_KEY (full key). AIDLC_LINEAR_API_URL overrides the endpoint (tests).
# Idempotent: each slice's description ends with `aidlc-slice: <FEATURE>/<key>`; existing slices
# and relations are skipped, so re-running after a crash or a plan edit only adds what is new.

set -euo pipefail

API="${AIDLC_LINEAR_API_URL:-https://api.linear.app/graphql}"
FEATURE=""
PLAN_FILE=""
DRY_RUN=0
BUILD_STATE="Build+Test"
BACKLOG_STATE=""

die() { echo "aidlc-slices: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --build-state) BUILD_STATE="$2"; shift 2 ;;
    --backlog-state) BACKLOG_STATE="$2"; shift 2 ;;
    --plan-file) PLAN_FILE="$2"; shift 2 ;;
    -h|--help) sed -n '3,20p' "$0"; exit 0 ;;
    -*) die "unknown option $1 (try --help)" ;;
    *) [ -z "$FEATURE" ] || die "one Feature key at a time"; FEATURE="$1"; shift ;;
  esac
done
command -v jq >/dev/null || die "jq is required"

# Extract the single ```aidlc-slices fenced block from markdown on stdin and validate it.
# Prints the normalized plan JSON. Every rule here mirrors the design skill's block rules.
extract_plan() {
  local md blocks body plan errs
  md=$(cat)
  blocks=$(printf '%s\n' "$md" | grep -cE '^[[:space:]]*```aidlc-slices[[:space:]]*$' || true)
  [ "$blocks" -eq 1 ] || die "expected exactly one \`\`\`aidlc-slices block in the Tech Spec, found $blocks"
  body=$(printf '%s\n' "$md" | awk '
    /^[[:space:]]*```aidlc-slices[[:space:]]*$/ { inb = 1; next }
    inb && /^[[:space:]]*```[[:space:]]*$/ { exit }
    inb { print }')
  plan=$(printf '%s\n' "$body" | jq -c . 2>/dev/null) || die "the aidlc-slices block is not valid JSON"
  errs=$(printf '%s\n' "$plan" | jq -r '
    def kebab: test("^[a-z0-9]+(-[a-z0-9]+)*$");
    . as $p
    | if .version != 1 then "version must be 1"
      elif (.slices | type) != "array" then "slices must be an array"
      elif ([.slices[] | type] | unique) - ["object"] != [] then "every slice must be an object"
      else
        (if (.slices | length) > 9 then "more than 9 slices: split the Feature" else empty end),
        (if ([.slices[].key] | length) != ([.slices[].key] | unique | length) then "duplicate slice keys" else empty end),
        ( .slices | to_entries[] | .key as $i | .value as $s
          | (if ($s.key | type) != "string" or ($s.key | kebab | not) then "slice \($i): key must be lowercase kebab-case" else empty end),
            (if ($s.title | type) != "string" or ($s.title | length) == 0 then "slice \($i) (\($s.key)): title required" else empty end),
            (if ($s.acceptance | type) != "array" or ($s.acceptance | length) == 0 or ([$s.acceptance[] | type] | unique) != ["string"]
             then "slice \($i) (\($s.key)): acceptance must be a non-empty list of strings" else empty end),
            ( ($s.blockedBy // []) as $b
              | if ($b | type) != "array" then "slice \($i) (\($s.key)): blockedBy must be a list"
                else ($p.slices[:$i] | map(.key)) as $earlier
                  | $b[] | select(. as $k | $earlier | index($k) | not)
                  | "slice \($i) (\($s.key)): blockedBy \"\(.)\" is not an earlier slice key (build order, no cycles)"
                end ) )
      end') || die "could not validate the slice plan"
  [ -z "$errs" ] || die "invalid slice plan:"$'\n'"$errs"
  printf '%s\n' "$plan"
}

if [ -n "$PLAN_FILE" ]; then
  [ -f "$PLAN_FILE" ] || die "no such file: $PLAN_FILE"
  PLAN=$(extract_plan < "$PLAN_FILE")
  n=$(printf '%s' "$PLAN" | jq '.slices | length')
  if [ "$n" -eq 0 ]; then echo "OK: 1-slice Feature (the Feature itself is the unit)"; else
    echo "OK: $n slices"
    printf '%s' "$PLAN" | jq -r '.slices[] | "  \(.key)  \(.title)" + (if (.blockedBy // []) | length > 0 then "  (after \((.blockedBy) | join(", ")))" else "" end)'
  fi
  exit 0
fi

[ -n "$FEATURE" ] || die "usage: aidlc-slices.sh ENG-123 [--dry-run] (or --plan-file FILE)"
KEY="${AIDLC_LINEAR_DAEMON_KEY:-}"
[ -n "$KEY" ] || die "AIDLC_LINEAR_DAEMON_KEY not set (the full key; this is a human/daemon tool)"

gql() { # query, variables-json → data json (dies on GraphQL errors)
  local body resp
  body=$(jq -nc --arg q "$1" --argjson v "$2" '{query: $q, variables: $v}')
  resp=$(curl -sS -m 30 "$API" -H 'Content-Type: application/json' -H "Authorization: $KEY" -d "$body") || die "request to $API failed"
  if printf '%s' "$resp" | jq -e '.errors | length > 0' >/dev/null 2>&1; then
    die "Linear error: $(printf '%s' "$resp" | jq -r '[.errors[].message] | join("; ")')"
  fi
  printf '%s' "$resp" | jq -c '.data'
}

ISSUE=$(gql 'query($id: String!) { issue(id: $id) {
  id identifier title state { name }
  team { id states(first: 100) { nodes { id name type position } } }
  project { id }
  documents(first: 50) { nodes { title content } }
  children(first: 100) { nodes { id identifier description
    relations(first: 50) { nodes { type relatedIssue { id } } } } }
} }' "$(jq -nc --arg id "$FEATURE" '{id: $id}')" | jq -c '.issue')
[ "$ISSUE" != "null" ] || die "no issue $FEATURE"

STATE=$(printf '%s' "$ISSUE" | jq -r '.state.name')
[ "$STATE" = "$BUILD_STATE" ] || die "$FEATURE is in \"$STATE\", not \"$BUILD_STATE\" — slices are created only after the human gates Design → $BUILD_STATE"

SPEC=$(printf '%s' "$ISSUE" | jq -c '[.documents.nodes[] | select(.title | startswith("Tech Spec"))]')
[ "$(printf '%s' "$SPEC" | jq length)" -eq 1 ] || die "expected one \"Tech Spec — …\" Document on $FEATURE, found $(printf '%s' "$SPEC" | jq length)"
PLAN=$(printf '%s' "$SPEC" | jq -r '.[0].content // ""' | extract_plan)

if [ "$(printf '%s' "$PLAN" | jq '.slices | length')" -eq 0 ]; then
  echo "$FEATURE is a 1-slice Feature: nothing to create, the Feature itself is the unit."
  exit 0
fi

if [ -n "$BACKLOG_STATE" ]; then
  STATE_ID=$(printf '%s' "$ISSUE" | jq -r --arg n "$BACKLOG_STATE" '[.team.states.nodes[] | select(.name == $n)][0].id // empty')
  [ -n "$STATE_ID" ] || die "team has no state named \"$BACKLOG_STATE\""
else
  STATE_ID=$(printf '%s' "$ISSUE" | jq -r '[.team.states.nodes[] | select(.type == "backlog")] | sort_by(.position) | .[0].id // empty')
  [ -n "$STATE_ID" ] || die "team has no backlog-type state; pass --backlog-state"
fi

FID=$(printf '%s' "$ISSUE" | jq -r '.id')
TEAM_ID=$(printf '%s' "$ISSUE" | jq -r '.team.id')
PROJECT_ID=$(printf '%s' "$ISSUE" | jq -r '.project.id // empty')

# key → issue id for slices that already exist (by marker).
EXISTING=$(printf '%s' "$ISSUE" | jq -c --arg f "$FEATURE" '
  [ .children.nodes[] | (.description // "") as $d
    | ($d | capture("aidlc-slice: " + $f + "/(?<k>[a-z0-9-]+)")?) as $m
    | select($m != null) | {key: $m.k, value: {id, identifier, blocks: [.relations.nodes[] | select(.type == "blocks") | .relatedIssue.id]}} ]
  | from_entries')

for k in $(printf '%s' "$EXISTING" | jq -r 'keys[]'); do
  printf '%s' "$PLAN" | jq -e --arg k "$k" '[.slices[].key] | index($k)' >/dev/null \
    || echo "warning: $(printf '%s' "$EXISTING" | jq -r --arg k "$k" '.[$k].identifier') ($k) is no longer in the slice plan — left as is"
done

IDS="$EXISTING"
for i in $(seq 0 $(( $(printf '%s' "$PLAN" | jq '.slices | length') - 1 ))); do
  S=$(printf '%s' "$PLAN" | jq -c ".slices[$i]")
  k=$(printf '%s' "$S" | jq -r '.key')
  if printf '%s' "$IDS" | jq -e --arg k "$k" 'has($k)' >/dev/null; then
    echo "exists  $(printf '%s' "$IDS" | jq -r --arg k "$k" '.[$k].identifier')  $k"
    continue
  fi
  DESC=$(printf '%s' "$S" | jq -r --arg f "$FEATURE" '
    "Slice of \($f)" + (if .section then " — Tech Spec section: \(.section)" else "" end)
    + "\n\n## Acceptance criteria\n" + ([.acceptance[] | "- " + .] | join("\n"))
    + "\n\n`aidlc-slice: \($f)/\(.key)`"')
  TITLE=$(printf '%s' "$S" | jq -r '.title')
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "create  (dry run)  $k  $TITLE"
    IDS=$(printf '%s' "$IDS" | jq -c --arg k "$k" '. + {($k): {id: ("dry-" + $k), identifier: "(new)", blocks: []}}')
    continue
  fi
  NEW=$(gql 'mutation($in: IssueCreateInput!) { issueCreate(input: $in) { success issue { id identifier } } }' \
    "$(jq -nc --arg t "$TEAM_ID" --arg p "$FID" --arg s "$STATE_ID" --arg pr "$PROJECT_ID" --arg ti "$TITLE" --arg d "$DESC" \
      '{in: ({teamId: $t, parentId: $p, stateId: $s, title: $ti, description: $d} + (if $pr == "" then {} else {projectId: $pr} end))}')" \
    | jq -c '.issueCreate.issue')
  [ "$NEW" != "null" ] || die "issueCreate failed for $k"
  echo "created $(printf '%s' "$NEW" | jq -r '.identifier')  $k  $TITLE"
  IDS=$(printf '%s' "$IDS" | jq -c --arg k "$k" --argjson n "$NEW" '. + {($k): {id: $n.id, identifier: $n.identifier, blocks: []}}')
done

# blockedBy chain: "<blocker> blocks <slice>".
for row in $(printf '%s' "$PLAN" | jq -r '.slices[] | .key as $k | (.blockedBy // [])[] | "\(.)>\($k)"'); do
  b="${row%%>*}"; s="${row##*>}"
  bid=$(printf '%s' "$IDS" | jq -r --arg k "$b" '.[$k].id')
  sid=$(printf '%s' "$IDS" | jq -r --arg k "$s" '.[$k].id')
  if printf '%s' "$IDS" | jq -e --arg k "$b" --arg sid "$sid" '.[$k].blocks | index($sid)' >/dev/null; then continue; fi
  if [ "$DRY_RUN" -eq 1 ]; then echo "relate  (dry run)  $b blocks $s"; continue; fi
  gql 'mutation($in: IssueRelationCreateInput!) { issueRelationCreate(input: $in) { success } }' \
    "$(jq -nc --arg i "$bid" --arg r "$sid" '{in: {issueId: $i, relatedIssueId: $r, type: "blocks"}}')" >/dev/null
  echo "related $b blocks $s"
done

FIRST=$(printf '%s' "$PLAN" | jq -r '[.slices[] | select((.blockedBy // []) | length == 0)][0].key')
echo "Done. Next: move $(printf '%s' "$IDS" | jq -r --arg k "$FIRST" '.[$k].identifier') ($FIRST) to $BUILD_STATE to start building (the daemon does this in P2)."
