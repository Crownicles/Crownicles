---
applyTo: '**'
---
# Code Review Checklist

Generic review procedure to catch common issues before submitting a PR. Based on recurring patterns found during code reviews.

---

## 1. Magic Strings & Constants

- [ ] **No hardcoded strings** used as identifiers, action names, or error codes — use `as const` objects (e.g., `CHEST_ACTIONS.DEPOSIT`, `EQUIP_ERRORS.INVALID`)
- [ ] **No hardcoded emojis** in code or translations — use `CrowniclesIcons.*` with `{emote:path}` pattern in translations
- [ ] **No hardcoded timezones or locale formats** — use system time aligned with game reset (e.g., `new Date().getHours()`), never `"Europe/Paris"` or `Intl.DateTimeFormat` with hardcoded locale
- [ ] **Data tags over hardcoded ID lists** — when items share a property (e.g., fire affinity), add a tag to the data JSON files (e.g., `"tags": ["fire"]`) and check via `ItemConstants.TAGS.X` instead of maintaining a static list of IDs in constants
- [ ] **Constants in the right location** — shared constants go in `Lib/src/constants/`, not duplicated across services
- [ ] **No duplicate constants** — search for similar values already defined elsewhere before creating new ones
- [ ] **Magic numbers as named constants** — any numeric literal in algorithms (primes, multipliers, masks) must be a named constant. Trivial values (0, 1, -1) in obvious contexts are acceptable
- [ ] **Pre-compute derived constants** — when a constant is always used in a derived form (e.g., hours → milliseconds), compute the derived value at the constant definition level (`FOO_MS = FOO_HOURS * 3_600_000`) and use that directly. Don't repeat the conversion formula at every call site

## 2. TypeScript Types

- [ ] **Explicit return types** on all functions (enforced by ESLint `@typescript-eslint/explicit-function-return-type`)
- [ ] **Derived union types** from `as const` objects using `typeof Object[keyof typeof Object]` — avoid raw `string` when a finite set of values exists
- [ ] **Type aliases for repeated inline types** — if an inline type `{ slot: number; category: ItemCategory }` appears 2+ times, extract it to a named type
- [ ] **Extract nested type accessors** — avoid repeating `SomeType["nested"]["field"][number]` across functions; extract to a `type Alias = SomeType["nested"]["field"][number]` and reference the alias
- [ ] **Shared types in `Lib/src/types/`** — types used across multiple packets or services must be extracted to a dedicated file in `Lib/src/types/`, not defined inline in packet files or duplicated across consumers
- [ ] **No `any`** — use proper types or generics
- [ ] **No unnecessary type assertions** — don't cast to `readonly T[]` or force types when the type is already correctly inferred; let TypeScript's inference do the work
- [ ] **Avoid `NonNullable<Awaited<ReturnType<...>>>`** — when a concrete model type exists (e.g., `Player`, `Home`, `Guild`), import and use it directly instead of deriving the type from a function's return type
- [ ] **Replace `null` with semantic values** — when `null` has a specific meaning (e.g., "not applicable"), use a named enum/constant (e.g., `NON_APPLICABLE = -3`) instead of `| null` everywhere
- [ ] **Parameter object pattern** for functions with 4+ arguments — group related parameters into a single options object
- [ ] **Group related optional fields into sub-objects** — instead of flat `petFoodType?`, `petFoodQuantity?`, `petFoodLovePoints?`, group into `petFood?: { type; quantity; lovePoints }`. This makes the relationship explicit and simplifies partial updates and spread operations
- [ ] **Use TypeScript overloads** when a function accepts multiple input types and returns a correspondingly typed output (e.g., `buildResponse(IgniteRes, params): IgniteRes` / `buildResponse(ReviveRes, params): ReviveRes`)

## 3. Code Complexity

- [ ] **No nested conditionals deeper than 2 levels** (CodeScene "Bumpy Road Ahead") — use `Array.find()`, early returns, or guard clauses to flatten
- [ ] **Cyclomatic complexity under threshold** (CodeScene "Complex Method") — extract helper functions for distinct logical sections
- [ ] **Functions do one thing** — if a function builds UI + handles interactions + processes data, split it into separate functions
- [ ] **Data-driven over sequential if-branches** — when 4+ similar if-blocks check different fields with the same pattern (e.g., comparing old vs new values), use a declarative array of checks iterated in a loop
- [ ] **Inline collectors extracted** — `createCollector` callbacks in menu builders should be extracted to named functions, not defined inline in the return object
- [ ] **Large files split by responsibility** — files with big switch statements covering many cases (e.g., one case per shop reaction) should be split into one file per case/handler
- [ ] **Max 4 function arguments** (CodeScene "Excess Number of Function Arguments") — use parameter objects for 5+
- [ ] **Early null checks / guard clauses** — when a nullable value is checked in 2+ downstream functions, validate it once at the top and pass guaranteed non-null values to sub-functions. Don't repeat the same `if (!x) return` in every helper
- [ ] **Use spread for field forwarding** — when passing 3+ fields from one object to another with the same keys, use `...obj` spread instead of listing fields one by one. Also prefer destructuring `const { unwanted, ...rest } = obj` to separate fields
- [ ] **Consistent parameter order across sibling functions** — related functions (e.g., handlers for the same feature) should use the same parameter order (e.g., `context, player, recipe` not `player, context, recipe` in one and `context, player` in another)
- [ ] **No boolean expression bugs** — watch for `x === null || undefined` (always truthy) instead of `x === null` or `x == null`. These are subtle bugs that TypeScript may not catch

## 4. Imports & Module Organization

- [ ] **No dynamic imports when static is possible** — `await import(...)` should only be used for genuine lazy-loading, not as a habit
- [ ] **No duplicate imports** — merge multiple imports from the same module (ESLint `no-duplicate-imports`)
- [ ] **Variables/functions defined before usage** — no "used before defined" anti-patterns (JS-0357)

## 5. Code Duplication

- [ ] **No repeated code blocks** — if 2+ places share similar logic (e.g., creating collectors, building menus), extract a shared helper
- [ ] **No repeated field-level operations** — if the same 3+ field assignments appear in multiple places (e.g., copying `itemId`, `itemLevel`, `itemEnchantmentId`), extract a `copyX` / `clearX` helper function
- [ ] **Shared utilities in appropriate scope** — helper used by one class → private method; used across files → utility function; used across services → Lib
- [ ] **Cross-file duplicate functions** — search for identical or near-identical private functions across command files (e.g., `withUnlimitedMaxValue` in both EquipCommand and ChestFeatureHandler) and move to a shared utility class
- [ ] **TypeScript overloads over duplicated functions** — when two functions differ only by type parameters/return types (e.g., `getBlacksmithUpgradeItem`/`getBlacksmithDisenchantItem`), use TypeScript function overloads with a single implementation
- [ ] **Reuse existing Lib utilities** — before implementing utility logic (e.g., `frac()`, `getWeekNumber()`), check if a shared function already exists in `Lib/src/utils/`
- [ ] **Domain logic belongs on the model** — if a check or computation is intrinsic to an entity (e.g., `isFoodCompatibleWithPet` belongs on `Pet`), place it as a method on the model class rather than in an unrelated service
- [ ] **Translation keys shared when appropriate** — if multiple commands use the same labels (e.g., category names), put them in a shared namespace (`items.json` not `commands.json`)

## 6. Translations (i18n)

- [ ] **Only modify French translations** (`Lang/fr/`) — other languages are synced via Crowdin
- [ ] **No direct speech** — all text should be narrative/descriptive, never dialogue with quotes
- [ ] **Emojis in translations use `{emote:path}` interpolation** — never hardcode emoji characters in translation files
- [ ] **Entity IDs as i18n parameters** — pass entity IDs (plantId, materialId, etc.) as interpolation parameters to translation keys instead of concatenating strings or emoji names in code
- [ ] **No dead/unused translation keys** — remove keys that are no longer referenced in code
- [ ] **No duplicate translation keys** — check if a similar key already exists before adding a new one

## 7. Dead Code & Cleanup

- [ ] **Remove unused imports, variables, and functions** — don't leave commented-out code or unreachable paths
- [ ] **Remove useless wrapper functions** — if a function only forwards to another with the exact same arguments and adds no logic, remove the wrapper and call the target directly
- [ ] **No useless constant aliases** — don't create a local alias for an imported constant that adds no semantic value (e.g., `const RECIPES = CookingConstants.RECIPES;`); use the original directly
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
grep -rn "Europe/Paris\|Intl.DateTimeFormat" src/  # Hardcoded timezones
```
