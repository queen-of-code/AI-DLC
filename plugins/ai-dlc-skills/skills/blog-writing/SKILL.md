---
name: blog-writing
description: Write blog posts in Melissa Benua's voice and style, saved to external-brain/blog-posts. Use when the user wants to write, draft, brainstorm, or edit a blog post, article, or written content for publication.
type: skill
aidlc_phases: [plan]
tags: [writing, content, blog]
requires: []
author: Melissa Benua
created_at: 2026-03-07
updated_at: 2026-03-07
---

# Blog Post Writing

Write blog posts that sound like Melissa wrote them, not an AI. Save to `~/GitHub/external-brain/blog-posts/`.

## Workflow

### Step 1: Research and Ideation

Before writing, use the **brain MCP** to gather context and ideas. This is a vector-indexed knowledge base over `~/GitHub/external-brain/` with semantic search, category filtering, and full document retrieval.

1. **Mine the external-brain for material**: Use `brain_search` to find relevant talks, meeting notes, architecture docs, and existing blog posts that relate to the topic. Melissa's best posts come from her real experience - find it. Use `brain_recent` and `brain_list_categories` to browse what's available.
2. **Check existing posts**: Use `brain_search` with `category: "blog-posts"` to avoid duplicating topics and to absorb the voice. Use `brain_get_document` to read full posts for style reference.
3. **Search the web**: Use the browser MCP to find current takes on the topic. Find what's already been said so the post can add something new, not rehash conventional wisdom.
4. **Look at talks**: Use `brain_search` with `category: "talks"` for presentation material that could be adapted or expanded into written form.

Present topic ideas and angles to the user before drafting. Include what source material you found.

### Step 2: Draft the Post

Write the post following the Style Guide below. Present the full draft for review.

### Step 3: Save the File

Save to `~/GitHub/external-brain/blog-posts/` with the naming convention:

```
YYYY-MM-DD-title-slug.md
```

Example: `2026-02-06-why-your-ci-pipeline-is-lying-to-you.md`

- Date is the creation date
- Title is lowercased, spaces replaced with hyphens, special characters removed

### Metadata Format

Every blog post starts with YAML frontmatter:

```yaml
---
title: "Your Post Title Here"
excerpt: "One-sentence summary for previews and social sharing"
date: "Month Day, Year"
updated: "Month Day, Year"
tags: ["Tag1", "Tag2", "Tag3"]
category: blog-posts
published_at: []
coverImage: "images/placeholder.jpg"
author:
  name: "Melissa Benua"
  role: "Engineering Leader & Speaker"
  avatar: "images/melissa-benua-headshot.jpeg"
---
```

Field notes:
- `date`: When the post was first written
- `updated`: When the post was last meaningfully edited (same as `date` for new posts)
- `published_at`: List of locations where this has been published, e.g. `["queenofcode.net", "dev.to", "LinkedIn"]`. Empty list for drafts.
- `tags`: 3-5 relevant topic tags
- `category`: Always `blog-posts`

---

## Style Guide

This is the most important section. Blog posts must read as if Melissa wrote them.

### Voice and Tone

- **Direct and confident**. State opinions clearly. Don't hedge everything with "it could be argued that" or "some might say." If the post has a point, make it.
- **Conversational but authoritative**. Write like you're explaining something to a smart colleague, not lecturing a classroom.
- **Pragmatic, not dogmatic**. Acknowledge tradeoffs. Prefer "here's what works and why" over "here's the one true way."
- **Use "you" and "we" naturally**. Address the reader directly. "If you've ever dealt with flaky tests..." not "If one has ever dealt with flaky tests..."
- **Humor is dry and subtle**. An occasional wry observation is fine. Never forced jokes or puns in headers.

### Structural Patterns

- **Open with a hook**: Start with a provocative claim, a question, or a concrete scenario. Not a generic introduction paragraph.
- **Use headers liberally**: Break content into scannable sections with clear H2 and H3 headers.
- **Lists and numbered items**: Use them for structure. Melissa's posts lean on bulleted lists and numbered steps.
- **Block quotes for emphasis**: Use `>` quotes to highlight key insights or reframe an argument.
- **End strong**: Close with a reframing of the original question, a call to action, or a memorable line. Not a limp summary.
- **Keep paragraphs short**: 2-4 sentences. Dense walls of text are not the style.

### Absolute Prohibitions

These will make the post immediately sound AI-generated:

- **NO EMOJIS**. None. Zero. Not in headers, not in body text, not in lists.
- **NO EM-DASHES**. Never use the character `—`. Melissa uses regular dashes `-` and double dashes `--` instead. This is the single easiest way to spot AI writing. Replace every `—` with ` - ` or ` -- `.
- **No "delve"**. Do not use the word "delve" anywhere.
- **No "landscape"** as a metaphor (e.g., "the testing landscape"). Overused AI filler.
- **No "In today's fast-paced world"** or any variation. Kill all throat-clearing openers.
- **No "Let's dive in"** or "Without further ado" or similar filler transitions.
- **No "It's worth noting that"** or "It bears mentioning" or "Interestingly enough."
- **No "leverage" as a verb** unless talking about actual mechanical advantage.
- **No "streamline"**. Use "simplify" or "speed up" or say what actually happens.
- **No "foster"** (as in "foster collaboration"). Just say "build" or "encourage."
- **No "harness"** (as in "harness the power of"). Just say "use."
- **No "robust"** unless describing something actually tested under stress.
- **No "it's important to note"**. If it's important, just say it.

### Preferred Phrasing

| Instead of (AI-speak) | Use (Melissa-speak) |
|------------------------|---------------------|
| utilize | use |
| leverage | use |
| a]myriad of | many, a lot of |
| in order to | to |
| it's worth noting | (just state the thing) |
| at the end of the day | ultimately, in practice |
| moving forward | going forward, next |
| deep dive | closer look |
| key takeaways | what matters |
| best practices | what works |
| stakeholders | people involved, the team |
| North Star | goal, guiding principle |
| synergy | (don't) |

### Technical Writing Notes

- **Code examples are welcome** when they illustrate a point. Keep them short and focused.
- **Be specific over abstract**. "We reduced deploy time from 45 minutes to 3 minutes" beats "We significantly improved deploy times."
- **Cite real tools and technologies by name**. Don't be vague about the stack.
- **Analogies are good** when they clarify. Melissa likes metaphors (and sometimes tortures them, per her own admission).

### Length

- Target 800-1500 words for a standard post
- Can go longer for deep technical content, but break it into clearly labeled sections
- If a post needs to be 2000+ words, consider splitting into a series

---

## Revision Checklist

Before finalizing, verify:

- [ ] No emojis anywhere in the post
- [ ] No em-dashes (`—`) - only regular dashes (`-`) or double dashes (`--`)
- [ ] No words from the prohibited list (delve, landscape, leverage, etc.)
- [ ] Opens with a hook, not a generic intro
- [ ] Ends with something memorable, not a limp summary
- [ ] Paragraphs are short (2-4 sentences)
- [ ] Frontmatter is complete with all required fields
- [ ] Filename follows YYYY-MM-DD-title-slug.md convention
- [ ] Read it aloud mentally - does it sound like a person or a chatbot?
