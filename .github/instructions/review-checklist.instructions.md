---
applyTo: '**'
---
# Code Review Checklist

Generic review procedure to catch common issues before submitting a PR. Based on recurring patterns found during code reviews.

---

## 1. Magic Strings & Constants

- [ ] **No hardcoded strings** used as identifiers, action names, or error codes — use `as const` objects (e.g., `CHEST_ACTIONS.DEPOSIT`, `EQUIP_ERRORS.INVALID`)
- [ ] **No hardcoded emojis** in code or translations — use `CrowniclesIcons.*` with `{emote:path}` pattern in translations
- [ ] **Constants in the right location** — shared constants go in `Lib/src/constants/`, not duplicated across services
- [ ] **No duplicate constants** — search for similar values already defined elsewhere before creating new ones

## 2. TypeScript Types

- [ ] **Explicit return types** on all functions (enforced by ESLint `@typescript-eslint/explicit-function-return-type`)
- [ ] **Derived union types** from `as const` objects using `typeof Object[keyof typeof Object]` — avoid raw `string` when a finite set of values exists
- [ ] **Type aliases for repeated inline types** — if an inline type `{ slot: number; category: ItemCategory }` appears 2+ times, extract it to a named type
- [ ] **No `any`** — use proper types or generics
- [ ] **Parameter object pattern** for functions with 4+ arguments — group related parameters into a single options object

## 3. Code Complexity

- [ ] **No nested conditionals deeper than 2 levels** (CodeScene "Bumpy Road Ahead") — use `Array.find()`, early returns, or guard clauses to flatten
- [ ] **Cyclomatic complexity under threshold** (CodeScene "Complex Method") — extract helper functions for distinct logical sections
- [ ] **Functions do one thing** — if a function builds UI + handles interactions + processes data, split it into separate functions
- [ ] **Max 4 function arguments** (CodeScene "Excess Number of Function Arguments") — use parameter objects for 5+

## 4. Imports & Module Organization

- [ ] **No dynamic imports when static is possible** — `await import(...)` should only be used for genuine lazy-loading, not as a habit
- [ ] **No duplicate imports** — merge multiple imports from the same module (ESLint `no-duplicate-imports`)
- [ ] **Variables/functions defined before usage** — no "used before defined" anti-patterns (JS-0357)

## 5. Code Duplication

- [ ] **No repeated code blocks** — if 2+ places share similar logic (e.g., creating collectors, building menus), extract a shared helper
- [ ] **Shared utilities in appropriate scope** — helper used by one class → private method; used across files → utility function; used across services → Lib
- [ ] **Translation keys shared when appropriate** — if multiple commands use the same labels (e.g., category names), put them in a shared namespace (`items.json` not `commands.json`)

## 6. Translations (i18n)

- [ ] **Only modify French translations** (`Lang/fr/`) — other languages are synced via Crowdin
- [ ] **No direct speech** — all text should be narrative/descriptive, never dialogue with quotes
- [ ] **Emojis in translations use `{emote:path}` interpolation** — never hardcode emoji characters in translation files
- [ ] **No dead/unused translation keys** — remove keys that are no longer referenced in code
- [ ] **No duplicate translation keys** — check if a similar key already exists before adding a new one

## 7. Dead Code & Cleanup

- [ ] **Remove unused imports, variables, and functions** — don't leave commented-out code or unreachable paths
- [ ] **Update related comments** when code changes — don't leave outdated "TODO" or "Future features" comments
- [ ] **Remove default cases that are unreachable** — if a switch exhausts all enum values, the default clause is dead code (or use it for the last case)

## 8. ESLint & Style

- [ ] **ESLint passes with zero errors** — run `pnpm eslint` in all modified services (Core, Discord, Lib)
- [ ] **Auto-fixable issues resolved** — run `pnpm eslintFix` before manual review
- [ ] **`async` only when needed** — don't mark functions `async` if they contain no `await` (ESLint `require-await`)
- [ ] **Consistent object formatting** — multi-property objects/destructuring on separate lines (`@stylistic/object-curly-newline`)

## 9. Tests

- [ ] **All existing tests pass** — run `pnpm test` in Core, Discord, and Lib
- [ ] **New logic has test coverage** where applicable — especially for utility functions and data transformations
- [ ] **No test regressions** — verify test count hasn't dropped

---

## Quick Pre-PR Verification

```bash
# Run in each modified service directory (Core, Discord, Lib)
pnpm eslint        # Zero errors
pnpm test          # All tests pass

# Check for common issues
grep -rn "await import(" src/             # Dynamic imports to review
grep -rn "\"✅\|\"❌\|\"⚠️\|\"🔥" src/   # Hardcoded emojis
```
