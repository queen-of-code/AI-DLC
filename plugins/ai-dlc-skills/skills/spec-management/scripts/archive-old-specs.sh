#!/bin/bash
#
# Archive old implemented specs
#
# Moves specs with status "Implemented" that are older than 30 days
# to the specs/archive/ directory.
#
# Usage:
#   ./archive-old-specs.sh [specs-directory]
#   ./archive-old-specs.sh specs/
#   ./archive-old-specs.sh --dry-run specs/
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DAYS_THRESHOLD=30
DRY_RUN=false
SPECS_DIR="specs"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            SPECS_DIR="$1"
            shift
            ;;
    esac
done

# Validate specs directory
if [ ! -d "$SPECS_DIR" ]; then
    echo "Error: Specs directory not found: $SPECS_DIR"
    exit 1
fi

# Create archive directory if it doesn't exist
ARCHIVE_DIR="$SPECS_DIR/archive"
if [ "$DRY_RUN" = false ]; then
    mkdir -p "$ARCHIVE_DIR"
fi

echo -e "${BLUE}Scanning for specs to archive...${NC}"
echo "Directory: $SPECS_DIR"
echo "Threshold: $DAYS_THRESHOLD days since implemented"
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}DRY RUN MODE - No files will be moved${NC}"
fi
echo ""

# Counter
archived=0
skipped=0

# Find all markdown files
find "$SPECS_DIR" -name "*.md" -type f | while read -r file; do
    # Skip template files
    if [[ "$file" == *"template"* ]] || [[ "$file" == *"archive"* ]]; then
        continue
    fi
    
    # Check if status is "Implemented"
    if grep -qi "|\s*\*\*Status\*\*\s*|\s*Implemented" "$file"; then
        # Get last modified date
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            file_age=$(( ( $(date +%s) - $(stat -f %m "$file") ) / 86400 ))
        else
            # Linux
            file_age=$(( ( $(date +%s) - $(stat -c %Y "$file") ) / 86400 ))
        fi
        
        if [ "$file_age" -ge "$DAYS_THRESHOLD" ]; then
            filename=$(basename "$file")
            relative_path="${file#$SPECS_DIR/}"
            
            echo -e "${GREEN}→${NC} Archiving: $relative_path (${file_age} days old)"
            
            if [ "$DRY_RUN" = false ]; then
                # Preserve directory structure in archive
                parent_dir=$(dirname "$relative_path")
                if [ "$parent_dir" != "." ]; then
                    mkdir -p "$ARCHIVE_DIR/$parent_dir"
                    mv "$file" "$ARCHIVE_DIR/$parent_dir/"
                else
                    mv "$file" "$ARCHIVE_DIR/"
                fi
            fi
            
            ((archived++)) || true
        else
            ((skipped++)) || true
        fi
    fi
done

echo ""
echo "Summary:"
echo "  Archived: $archived specs"
echo "  Skipped: $skipped specs (not old enough)"

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo -e "${YELLOW}Run without --dry-run to actually move files${NC}"
fi
