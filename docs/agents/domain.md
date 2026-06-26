# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repo root
- `docs/adr/` for architectural decisions that touch the area being changed

If any of these files do not exist, proceed silently. Do not flag their absence or suggest creating them upfront.

## File structure

This repo uses a single-context layout:

```text
/
|-- CONTEXT.md
|-- docs/
|   `-- adr/
`-- apps/
```

## Use the glossary's vocabulary

When output names a domain concept, use the term as defined in `CONTEXT.md`. If the concept is missing, note the gap rather than inventing a competing term.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding it.
