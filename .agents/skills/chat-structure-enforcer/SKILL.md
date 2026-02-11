---
name: chat-structure-enforcer
description: Enforces structured chat answer formatting for kiosk readability. Use when assistant responses appear as long paragraphs and need consistent headings, bullet points, and line breaks across EN/AR/FR.
---

# Chat Structure Enforcer

Use this skill to validate response structure quality for chat UX.

## Workflow

1. Collect sample responses in a text file (one response) or JSON array.
2. Run:
   - `python .agents/skills/chat-structure-enforcer/scripts/check_chat_structure.py --file <path>`
3. Fix generation prompts or frontend normalization when checks fail.

## Passing criteria

- Response has headings.
- Response includes bullet list items.
- Response is not a single unbroken paragraph.

## References

- `references/rules.md` for structure requirements.

