#!/usr/bin/env python3
"""
Validate a spec file for completeness.

Usage:
    python validate-spec.py path/to/spec.md
    python validate-spec.py specs/frontend/my-feature.md --strict
"""

import sys
import re
from pathlib import Path
from typing import List, Tuple

# Required sections for all specs
REQUIRED_SECTIONS = [
    "overview",
    "business context",
    "requirements",
    "acceptance criteria",
]

# Additional required sections for strict mode
STRICT_SECTIONS = [
    "technical approach",
    "testing strategy",
    "rollout plan",
    "rollback plan",
]

# Required fields in overview table
REQUIRED_OVERVIEW_FIELDS = [
    "feature name",
    "type",
    "status",
    "author",
]


def extract_sections(content: str) -> List[str]:
    """Extract all section headers from markdown content."""
    # Match ## headers
    pattern = r'^##\s+(.+)$'
    sections = re.findall(pattern, content, re.MULTILINE)
    return [s.lower().strip() for s in sections]


def extract_overview_fields(content: str) -> List[str]:
    """Extract fields from the overview table."""
    # Find the overview section
    overview_match = re.search(
        r'##\s+Overview.*?\n(.*?)(?=\n##|\Z)',
        content,
        re.IGNORECASE | re.DOTALL
    )
    if not overview_match:
        return []
    
    overview_content = overview_match.group(1)
    
    # Extract field names from table rows (| **Field** | value |)
    pattern = r'\|\s*\*\*([^*]+)\*\*\s*\|'
    fields = re.findall(pattern, overview_content)
    return [f.lower().strip() for f in fields]


def check_acceptance_criteria(content: str) -> Tuple[bool, List[str]]:
    """Check if acceptance criteria section has checkboxes."""
    issues = []
    
    # Find acceptance criteria section
    ac_match = re.search(
        r'##\s+Acceptance Criteria.*?\n(.*?)(?=\n##|\Z)',
        content,
        re.IGNORECASE | re.DOTALL
    )
    
    if not ac_match:
        return False, ["No Acceptance Criteria section found"]
    
    ac_content = ac_match.group(1)
    
    # Check for checkboxes
    checkboxes = re.findall(r'- \[[ x]\]', ac_content, re.IGNORECASE)
    if not checkboxes:
        issues.append("Acceptance criteria should use checkboxes (- [ ] item)")
        return False, issues
    
    if len(checkboxes) < 3:
        issues.append(f"Only {len(checkboxes)} acceptance criteria found (recommend at least 3)")
    
    return True, issues


def check_related_specs(content: str) -> List[str]:
    """Check if related specs section exists and has valid links."""
    issues = []
    
    related_match = re.search(
        r'##\s+Related Specs.*?\n(.*?)(?=\n##|\Z)',
        content,
        re.IGNORECASE | re.DOTALL
    )
    
    if not related_match:
        issues.append("Consider adding a Related Specs section if this feature has dependencies")
        return issues
    
    related_content = related_match.group(1)
    
    # Check for proper format
    links = re.findall(r'-\s*(Frontend|Backend|Related):\s*([^\n]+)', related_content, re.IGNORECASE)
    
    for link_type, link_path in links:
        if '.md' not in link_path:
            issues.append(f"Related spec link should include .md extension: {link_path}")
        if ' - ' not in link_path:
            issues.append(f"Related spec should include description: {link_type}: path/to/spec.md - Description")
    
    return issues


def validate_spec(filepath: Path, strict: bool = False) -> Tuple[bool, List[str]]:
    """Validate a spec file and return (is_valid, issues)."""
    issues = []
    
    if not filepath.exists():
        return False, [f"File not found: {filepath}"]
    
    content = filepath.read_text()
    
    # Check for empty content
    if len(content.strip()) < 100:
        return False, ["Spec appears to be empty or too short"]
    
    # Extract sections
    sections = extract_sections(content)
    
    # Check required sections
    required = REQUIRED_SECTIONS + (STRICT_SECTIONS if strict else [])
    for section in required:
        if not any(section in s for s in sections):
            issues.append(f"Missing required section: {section}")
    
    # Check overview fields
    overview_fields = extract_overview_fields(content)
    for field in REQUIRED_OVERVIEW_FIELDS:
        if not any(field in f for f in overview_fields):
            issues.append(f"Missing required overview field: {field}")
    
    # Check status is set
    status_match = re.search(r'\|\s*\*\*Status\*\*\s*\|\s*([^|]+)\|', content)
    if status_match:
        status = status_match.group(1).strip()
        if status.startswith('[') or not status:
            issues.append("Status field should be set to a valid status (Draft, Review, Approved, etc.)")
    
    # Check acceptance criteria
    ac_valid, ac_issues = check_acceptance_criteria(content)
    issues.extend(ac_issues)
    
    # Check related specs
    related_issues = check_related_specs(content)
    issues.extend(related_issues)
    
    # Check for placeholder text
    placeholders = [
        r'\[Name of the feature\]',
        r'\[Your name\]',
        r'\[YYYY-MM-DD\]',
        r'\[Description\]',
        r'\[TODO\]',
    ]
    for pattern in placeholders:
        if re.search(pattern, content):
            issues.append(f"Contains placeholder text: {pattern}")
    
    return len(issues) == 0, issues


def main():
    if len(sys.argv) < 2:
        print("Usage: python validate-spec.py <path-to-spec.md> [--strict]")
        sys.exit(1)
    
    filepath = Path(sys.argv[1])
    strict = '--strict' in sys.argv
    
    print(f"Validating: {filepath}")
    print(f"Mode: {'Strict' if strict else 'Standard'}")
    print("-" * 40)
    
    is_valid, issues = validate_spec(filepath, strict)
    
    if is_valid:
        print("✓ Spec is valid!")
        sys.exit(0)
    else:
        print("✗ Spec has issues:\n")
        for issue in issues:
            print(f"  • {issue}")
        print()
        sys.exit(1)


if __name__ == '__main__':
    main()
