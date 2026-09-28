#!/bin/bash
#
# AI-DLC installer — skills library for Cursor and Claude Code
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/queen-of-code/AI-DLC/main/install.sh | bash
#   curl -fsSL ... | bash -s -- --force   # replace existing skill dirs/symlinks
#
# Or from a clone:
#   ./install.sh
#   ./install.sh --force
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_URL="https://github.com/queen-of-code/AI-DLC.git"
INSTALL_DIR="$HOME/.ai-dlc"
CURSOR_SKILLS_DIR="$HOME/.cursor/skills"
CLAUDE_SKILLS_DIR="$HOME/.claude/skills"

# Set by parse_args: 1 = remove existing skill dir/symlink and link from ~/.ai-dlc/skills
FORCE=0

parse_args() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --force|-f)
        FORCE=1
        shift
        ;;
      -h|--help)
        echo "Usage: $0 [--force|-f]"
        echo "  --force  Replace existing entries under ~/.cursor/skills and ~/.claude/skills"
        echo "           (removes conflicting directories or wrong symlinks, then symlinks from AI-DLC)."
        exit 0
        ;;
      *)
        echo "Unknown option: $1 (try --help)" >&2
        exit 1
        ;;
    esac
  done
}

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              AI-DLC — skills install          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

info() { echo -e "${BLUE}→${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }

get_script_dir() {
  if [ -d "$INSTALL_DIR" ]; then
    echo "$INSTALL_DIR"
  elif [ -d "$(dirname "$0")/skills" ]; then
    echo "$(cd "$(dirname "$0")" && pwd)"
  else
    echo ""
  fi
}

setup_repo() {
  if [ -d "$INSTALL_DIR/.git" ]; then
    info "Updating existing installation..."
    cd "$INSTALL_DIR"
    git fetch origin
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)
    if [ "$LOCAL" != "$REMOTE" ]; then
      git pull origin main
      success "Updated to latest version"
    else
      success "Already up to date"
    fi
  else
    if [ -d "$INSTALL_DIR" ]; then
      warn "Removing existing non-git directory at $INSTALL_DIR"
      rm -rf "$INSTALL_DIR"
    fi
    info "Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    success "Repository cloned to $INSTALL_DIR"
  fi
}

create_skill_symlinks() {
  local source_dir="$1"
  local target_dir="$2"
  local platform_name="$3"
  mkdir -p "$target_dir"
  local linked=0
  local skipped=0
  for skill_dir in "$source_dir"/*/; do
    if [ -d "$skill_dir" ]; then
      skill_name=$(basename "$skill_dir")
      target_link="$target_dir/$skill_name"
      if [ "$FORCE" = "1" ]; then
        if [ -e "$target_link" ] || [ -L "$target_link" ]; then
          rm -rf "$target_link"
        fi
        ln -s "${skill_dir%/}" "$target_link"
        ((linked++)) || true
      elif [ -L "$target_link" ]; then
        current_target=$(readlink "$target_link")
        if [ "$current_target" = "$skill_dir" ] || [ "$current_target" = "${skill_dir%/}" ]; then
          ((skipped++)) || true
        else
          warn "Symlink $target_link points elsewhere, skipping (use --force to replace)"
          ((skipped++)) || true
        fi
      elif [ -d "$target_link" ]; then
        warn "Directory exists at $target_link, skipping (use --force to replace)"
        ((skipped++)) || true
      else
        ln -s "${skill_dir%/}" "$target_link"
        ((linked++)) || true
      fi
    fi
  done
  if [ $linked -gt 0 ]; then
    success "Linked $linked skills to $platform_name"
  fi
  if [ $skipped -gt 0 ]; then
    info "Skipped $skipped existing skills in $platform_name"
  fi
}

main() {
  parse_args "$@"

  if ! command -v git &> /dev/null; then
    error "git is required but not installed"
    exit 1
  fi

  SCRIPT_DIR=$(get_script_dir)
  if [ -z "$SCRIPT_DIR" ] || [ ! -d "$SCRIPT_DIR/skills" ]; then
    setup_repo
    SCRIPT_DIR="$INSTALL_DIR"
  else
    if [ "$SCRIPT_DIR" != "$INSTALL_DIR" ]; then
      info "Running from local clone at $SCRIPT_DIR"
      if [ ! -d "$INSTALL_DIR" ]; then
        info "Creating installation at $INSTALL_DIR"
        cp -r "$SCRIPT_DIR" "$INSTALL_DIR"
      fi
    fi
  fi

  SKILLS_SOURCE="$INSTALL_DIR/skills"
  if [ ! -d "$SKILLS_SOURCE" ]; then
    error "Skills directory not found at $SKILLS_SOURCE"
    exit 1
  fi

  echo ""
  if [ "$FORCE" = "1" ]; then
    warn "Force mode: replacing conflicting skill dirs/symlinks under ~/.cursor/skills and ~/.claude/skills"
  fi
  info "Installing skills..."
  create_skill_symlinks "$SKILLS_SOURCE" "$CURSOR_SKILLS_DIR" "Cursor (~/.cursor/skills)"
  create_skill_symlinks "$SKILLS_SOURCE" "$CLAUDE_SKILLS_DIR" "Claude Code (~/.claude/skills)"

  echo ""
  echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║         Installation complete!             ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
  echo ""
  echo "Skills are available in Cursor and Claude Code skill directories."
  echo ""
  echo "Claude Code marketplace (from repo root):"
  echo "  /plugin marketplace add /path/to/AI-DLC"
  echo "  /plugin install ai-dlc-skills@ai-dlc"
  echo ""
  echo "To update:"
  echo "  cd $INSTALL_DIR && git pull && ./install.sh"
  echo "  cd $INSTALL_DIR && git pull && ./install.sh --force   # replace existing skill links"
  echo ""
}

main "$@"
