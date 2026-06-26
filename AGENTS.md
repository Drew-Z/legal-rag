# Repository Instructions

## Agent skills

### Issue tracker

Issues and PRDs are tracked as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The repo uses the default five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo: use root-level `CONTEXT.md` and `docs/adr/` when present. See `docs/agents/domain.md`.

## Windows / PowerShell

- Prefer simple commands without shell metacharacters.
- When searching multiple patterns with `rg`, prefer repeated calls or `-e pattern`.
- For multiline Python, pipe a PowerShell here-string into the project Python executable.
- Use PowerShell native commands with `-LiteralPath` for Windows paths.
- Run scripts that write shared JSON or manifests serially.
