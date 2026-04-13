#!/usr/bin/env python3
"""
Download a Google Doc as markdown to ~/GitHub/external-brain/.

Usage:
    python download-gdoc.py "https://docs.google.com/document/d/DOC_ID/edit"
    python download-gdoc.py "https://docs.google.com/document/d/DOC_ID/edit" --category meetings
    python download-gdoc.py "https://docs.google.com/document/d/DOC_ID/edit" --output ~/custom/path
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


def load_env():
    """Load .env file from skill directory."""
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


load_env()


def get_access_token() -> str:
    """Get access token from gcloud auth with Drive API scopes."""
    # Try application-default first (has proper scopes when configured)
    result = subprocess.run(
        ["gcloud", "auth", "application-default", "print-access-token"],
        capture_output=True,
        text=True
    )
    if result.returncode == 0:
        return result.stdout.strip()
    
    # Fall back to regular auth
    result = subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"Error getting access token: {result.stderr}", file=sys.stderr)
        print("Run: gcloud auth application-default login --scopes=\"https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/drive.readonly\"", file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip()


def extract_doc_id(url: str) -> str:
    """Extract the document ID from a Google Docs URL."""
    # Handle various URL formats:
    # https://docs.google.com/document/d/DOC_ID/edit
    # https://docs.google.com/document/d/DOC_ID/edit?...
    # https://docs.google.com/document/d/DOC_ID
    
    patterns = [
        r'/document/d/([a-zA-Z0-9_-]+)',
        r'docs\.google\.com/document/d/([a-zA-Z0-9_-]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    raise ValueError(f"Could not extract document ID from URL: {url}")


def get_quota_project() -> str:
    """Get the quota project from env or gcloud config."""
    # Check environment variable first
    if os.environ.get("GCLOUD_QUOTA_PROJECT"):
        return os.environ["GCLOUD_QUOTA_PROJECT"]
    
    # Fall back to gcloud config
    result = subprocess.run(
        ["gcloud", "config", "get-value", "project"],
        capture_output=True,
        text=True
    )
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    return ""


def get_doc_metadata(doc_id: str, access_token: str, quota_project: str) -> dict:
    """Fetch document metadata from Google Drive API."""
    headers = [
        "-H", f"Authorization: Bearer {access_token}",
    ]
    if quota_project:
        headers.extend(["-H", f"x-goog-user-project: {quota_project}"])
    
    result = subprocess.run(
        [
            "curl", "-s",
            *headers,
            f"https://www.googleapis.com/drive/v3/files/{doc_id}?fields=name,owners"
        ],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"Failed to fetch metadata: {result.stderr}")
    
    data = json.loads(result.stdout)
    if "error" in data:
        raise RuntimeError(f"API error: {data['error']['message']}")
    
    return data


def download_as_markdown(doc_id: str, access_token: str, quota_project: str) -> str:
    """Download the document as markdown."""
    headers = [
        "-H", f"Authorization: Bearer {access_token}",
    ]
    if quota_project:
        headers.extend(["-H", f"x-goog-user-project: {quota_project}"])
    
    result = subprocess.run(
        [
            "curl", "-s",
            *headers,
            f"https://www.googleapis.com/drive/v3/files/{doc_id}/export?mimeType=text/markdown"
        ],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"Failed to download document: {result.stderr}")
    
    # Check for API error response
    if result.stdout.startswith("{"):
        try:
            data = json.loads(result.stdout)
            if "error" in data:
                raise RuntimeError(f"API error: {data['error']['message']}")
        except json.JSONDecodeError:
            pass
    
    return result.stdout


def slugify(text: str) -> str:
    """Convert text to a safe filename."""
    # Lowercase
    text = text.lower()
    # Replace spaces and underscores with hyphens
    text = re.sub(r'[\s_]+', '-', text)
    # Remove special characters except hyphens
    text = re.sub(r'[^a-z0-9-]', '', text)
    # Remove multiple consecutive hyphens
    text = re.sub(r'-+', '-', text)
    # Strip leading/trailing hyphens
    text = text.strip('-')
    return text


def create_frontmatter(url: str, doc_id: str, owner: str, category: str) -> str:
    """Create YAML frontmatter for the markdown file."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return f"""---
source_url: {url}
doc_id: {doc_id}
downloaded_at: {now}
owner: {owner}
category: {category}
---

"""


def main():
    parser = argparse.ArgumentParser(
        description="Download a Google Doc as markdown"
    )
    parser.add_argument(
        "url",
        help="Google Doc URL"
    )
    parser.add_argument(
        "--category",
        default="uncategorized",
        help="Category for the document (default: uncategorized)"
    )
    parser.add_argument(
        "--output",
        default=str(Path.home() / "GitHub" / "external-brain"),
        help="Output directory (default: ~/GitHub/external-brain)"
    )
    parser.add_argument(
        "--project",
        default=None,
        help="GCP project ID for quota (uses gcloud default if not specified)"
    )
    
    args = parser.parse_args()
    
    # Extract document ID
    try:
        doc_id = extract_doc_id(args.url)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    
    print(f"Document ID: {doc_id}")
    
    # Get access token
    print("Getting access token...")
    access_token = get_access_token()
    
    # Get quota project
    quota_project = args.project if args.project else get_quota_project()
    if quota_project:
        print(f"Using quota project: {quota_project}")
    else:
        print("Warning: No quota project set, API calls may fail")
    
    # Fetch metadata
    print("Fetching document metadata...")
    try:
        metadata = get_doc_metadata(doc_id, access_token, quota_project)
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    
    doc_name = metadata.get("name", "untitled")
    owners = metadata.get("owners", [])
    owner_email = owners[0].get("emailAddress", "unknown") if owners else "unknown"
    
    print(f"Document: {doc_name}")
    print(f"Owner: {owner_email}")
    
    # Download as markdown
    print("Downloading as markdown...")
    try:
        content = download_as_markdown(doc_id, access_token, quota_project)
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Create output path
    output_dir = Path(args.output).expanduser()
    if not output_dir.exists():
        print(f"Error: Output directory does not exist: {output_dir}", file=sys.stderr)
        sys.exit(1)
    
    filename = f"{slugify(doc_name)}.md"
    output_path = output_dir / filename
    
    # Create frontmatter
    frontmatter = create_frontmatter(args.url, doc_id, owner_email, args.category)
    
    # Write file
    full_content = frontmatter + content
    output_path.write_text(full_content)
    
    print(f"✓ Saved to: {output_path}")
    return str(output_path)


if __name__ == "__main__":
    main()
