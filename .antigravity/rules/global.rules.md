# MacroMogul - Global Rules

## Naming
- Project name is: MacroMogul.
- Never introduce or keep legacy project names in any tracked file.
- User-facing UI must not display the word "Close" or "Kapat" as a label (use icon × or tooltip if needed).

## Repo hygiene
- Never edit node_modules or build artifacts.
- All changes must be in tracked source/docs only.
- Before committing, run:
  - git grep -nE "capitalism-lab-clone|capitalism-clone" || true
  - git grep -nE "\"Close\"|'Close'|>Close<|>close<|\"close\"|'close'" || true

## Output discipline
- Prefer minimal, safe changes.
- If UI text changes, update i18n keys rather than hardcoding strings.

## Git
- Commit messages must describe outcome, not intent.
- No force push unless explicitly requested.
