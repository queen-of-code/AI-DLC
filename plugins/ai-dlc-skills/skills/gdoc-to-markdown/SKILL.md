---
name: gdoc-to-markdown
description: Download Google Docs as markdown files to external-brain folder. Use when the user provides a Google Doc URL and wants to save it locally, archive documentation, or import Google Docs content.
type: skill
aidlc_phases: [plan]
tags: [google-docs, markdown, documentation, external-brain]
requires: []
author: Melissa Benua
created_at: 2026-03-07
updated_at: 2026-03-07
---

# Google Doc to Markdown

Downloads a Google Doc as markdown and saves it to `~/GitHub/external-brain/`.

## When to Use

- User provides a Google Doc URL to download
- Archiving documentation from Google Docs
- Importing Google Docs content into the knowledge base

## Quick Start

Run the download script with a Google Doc URL:

```bash
python scripts/download-gdoc.py "https://docs.google.com/document/d/DOC_ID/edit"
```

### Optional Arguments

```bash
# Specify a category for organization
python scripts/download-gdoc.py "URL" --category meetings

# Specify a custom output directory
python scripts/download-gdoc.py "URL" --output ~/GitHub/external-brain/notes
```

## Prerequisites

- `gcloud` CLI installed and authenticated
- Access to the Google Doc being downloaded
- `~/GitHub/external-brain/` directory exists

### Authentication

The script uses gcloud auth with Drive API scopes. Run this once:

```bash
gcloud auth application-default login --scopes="https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/drive.readonly"
```

### GCP Project Configuration

The `.env` file in this skill directory configures the quota project:

```
GCLOUD_QUOTA_PROJECT=queen-of-code
```

The project must have the Google Drive API enabled. Enable it at:
https://console.developers.google.com/apis/api/drive.googleapis.com/overview

## Output Format

Files are saved with:
- Filename derived from document title (slugified)
- YAML frontmatter with metadata

### Metadata Header

```yaml
---
source_url: https://docs.google.com/document/d/DOC_ID/edit
doc_id: DOC_ID
downloaded_at: 2026-02-05T14:30:00Z
owner: owner@example.com
category: uncategorized
---
```

## File Naming

Document titles are converted to safe filenames:
- Lowercased
- Spaces replaced with hyphens
- Special characters removed
- `.md` extension added

Example: "Q1 Planning Meeting Notes" → `q1-planning-meeting-notes.md`

## Scripts

**download-gdoc.py**: Main download script

```bash
python scripts/download-gdoc.py "https://docs.google.com/document/d/1ABC123/edit"
```

Returns the path to the saved file on success.
