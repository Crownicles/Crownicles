# Concurrency Hardening Plan — `tx-isolation` branch

> **Goal**: eliminate the class of bugs where two concurrent MQTT packet handlers
> read-modify-write the same DB row (player money, guild treasury / storage,
> pet, mission progress, …) and one of the writes is silently lost or a
> validation is bypassed (double-spend, treasury overdraft, storage cap
> exceeded, item duplication on pet trade, …).
>
> The bug raised on `handleFoodShopBuy` is the visible tip of a codebase-wide
> pattern: ~175 `xxx.save()` call sites across Core and only **2** are
> currently guarded (`GuildDailyCommand`, `handleGuildDomainDepositTreasury`).
>
> **Additional goal (confirmed by reviewer)**: the solution must keep working
> if Core is later deployed as **multiple instances**. ⇒ in-process locks are
> not enough; we need DB-backed locking.
>
> This document is the **single source of truth** for the work. It is updated
> as work progresses — checkboxes reflect real status. Work is split across
> a **merge train of PRs** (see §5).

---

## 0. Architectural facts (verified)

- **Today**: Core is a single Node.js process (no shard config).
- **Tomorrow**: Core may be deployed multi-instance. The plan must support that
  without rewriting call sites.
- **Concurrency source**: MQTT messages are dispatched concurrently — every
  `await` between `Players.getByKeycloakId(...)` and `player.save()` yields
  the event loop, so a second packet for the same player can interleave.
- **Sequelize version**: `6.37.7` (verified in all 4 service `package.json`).
- **Existing primitive**: `Lib/src/locks/AsyncLock.ts` + `LockManager.ts`
  (in-process FIFO). Used in 2 places. Will be **kept** as an optional
  same-process coalescing optimisation but is no longer the correctness
  mechanism.
- **No existing `sequelize.transaction()` calls** in `Core/src` (`grep` returns 0).
- **Test infra**: Vitest is wired for unit tests. **No integration test
  framework exists** — this PR train introduces one.

## 1. Strategy — confirmed decisions

| Decision | Choice | Rationale |
|---|---|---|
| Locking mechanism | **Sequelize transaction + `SELECT … FOR UPDATE`** via `findByPk(..., { lock: true, transaction: t })` | Native Sequelize/MariaDB. Works mono- and multi-instance. Zero custom logic. |
| Transaction threading to existing `xxx.save()` calls | **`Sequelize.useCLS(namespace)`** with **`cls-hooked`** dep | Documented Sequelize v6 path. Reviewer accepts the dep for the zero-maintenance / battle-tested upside. ~175 call sites are not touched. |
| Composite locks | Deterministic ordering: `(tableName, id)` lexicographic, applied **inside** `withLockedEntities` | Prevents deadlocks; callers can pass keys in any order. |
| Re-fetch inside critical section | **Mandatory** — `withLockedEntities` does the re-fetch and passes fresh entities to the callback | Closes the bug pattern: any value read before the lock is discarded. |
| In-process `AsyncLock` | Kept as an **opt-in coalescing optimisation** layered above DB locks | Cheap insurance; not on the critical correctness path. |
| Integration tests | New `pnpm test:integration` against a real **MariaDB** (local: reuse dev DB with a randomised `prefix`; CI: a `mariadb` service in GitHub Actions) | No `testcontainers` dep. Must run on every PR. |
| ESLint guard rail | Custom rule forbidding `xxx.save()` outside `withLockedEntities`, with allow-list (cron / admin / GDPR / read-only) | Prevents regression after the migration. |
| Delivery | **Merge train of PRs**, not one mega-PR. This MD ships with every PR. | Faster review, easier revert. Reviewer confirmed: "fais bien toutes les PRs". |

## 2. Public API of the new module

We use **lock helpers attached to the model class** (DDD-friendly, type-safe,
no magic strings, no global registry). Lib stays generic — it only knows
`Model` / `ModelStatic` from Sequelize.

```ts
// Lib/src/locks/withLockedEntities.ts — purely generic
import { Model, ModelStatic } from "sequelize";

export interface LockKey<M extends Model> {
  readonly model: ModelStatic<M>;
  readonly id: number;
}

// Opens a transaction, sorts keys canonically by (model.tableName, id),
// dedupes duplicates, acquires SELECT … FOR UPDATE on each row, then
// passes a tuple of freshly-fetched instances to the callback (in the
// caller's original order). Any xxx.save() inside `fn` inherits the
// transaction through Sequelize CLS. Throws ⇒ rollback; resolves ⇒ commit.
export async function withLockedEntities<
  K extends readonly LockKey<Model>[],
  R
>(
  keys: K,
  fn: (entities: { [I in keyof K]: K[I] extends LockKey<infer M> ? M : never }) => Promise<R>
): Promise<R>;
```

```ts
// In Core models — additions to existing Player / Guild / Pet / Home / …
class Player extends Model {
  static lockKey(id: number): LockKey<Player> { return { model: Player, id }; }
  static withLocked<R>(id: number, fn: (p: Player) => Promise<R>): Promise<R> {
    return withLockedEntities([Player.lockKey(id)], ([p]) => fn(p));
  }
}
```

Call-site shapes:

```ts
// Single entity
return Player.withLocked(playerId, async player => {
  player.money -= cost;
  await player.save(); // CLS injects the transaction
});

// Composite (e.g. pet trade)
return withLockedEntities(
  [Player.lockKey(sellerId), Player.lockKey(buyerId), Pet.lockKey(petId)],
  async ([seller, buyer, pet]) => { /* … */ }
);
```

## 3. Test strategy

| Layer | Tool | Goal |
|---|---|---|
| `AsyncLock`, `LockManager`, key-ordering | Unit (Vitest, no DB) | Behavioural contract |
| `withLockedEntities` end-to-end | **Integration** (Vitest + real MariaDB) | Two parallel callers serialise; rollback on throw; CLS propagation to nested `save()` |
| Per-handler race tests | **Integration** | For each migrated handler: two concurrent calls + assert at most one passes when only one fits the budget / capacity |
| Existing unit tests | Vitest | Stay green |

**Integration test infra (PR-B)**:
- New script `pnpm test:integration` in `Core/package.json`.
- Helper `Core/__tests__-integration/_setup.ts` that:
  - reads MariaDB host/port/user/pass from env (defaults pointing at the local dev DB),
  - generates a unique prefix `crownicles_test_<pid>_<rand>`,
  - calls the existing migration runner against that prefix,
  - returns a teardown that drops the schemas.
- GitHub Actions workflow `integration-tests.yml` with a `services: mariadb` block, runs on every PR.

## 4. Inventory of vulnerable handlers

Generated from `grep player.save / guild.save` + manual review.

### 4.1 Critical — money / treasury / storage (silent overdraft possible)

- [ ] `Core/src/core/report/ReportCityFoodShopService.ts` — `handleFoodShopBuy` (the original bug)
- [ ] `Core/src/core/report/ReportCityGuildDomainShopService.ts` — already locks guild but reads `player.money` **before** the lock. Migrate + add player lock.
- [ ] `Core/src/commands/player/ReportCommand.ts` — shop / chest reactions
- [ ] `Core/src/core/report/ReportCityChestService.ts`
- [ ] `Core/src/core/report/ReportCityBlacksmithService.ts`
- [ ] `Core/src/core/report/ReportCityEnchanterService.ts`
- [ ] `Core/src/core/report/ReportCityHomeService.ts`
- [ ] `Core/src/core/report/ReportCityInnService.ts`
- [ ] `Core/src/core/report/ReportTokenHealService.ts`
- [ ] `Core/src/commands/mission/MissionShopCommand.ts`
- [ ] `Core/src/core/utils/MissionShopItems.ts`
- [ ] `Core/src/core/utils/TannerShopItems.ts`
- [ ] `Core/src/core/utils/VeterinarianShopItems.ts`
- [ ] `Core/src/core/utils/GeneralShopItems.ts`
- [ ] `Core/src/core/smallEvents/interfaces/Shop.ts`
- [ ] `Core/src/core/utils/ShopUtils.ts`

### 4.2 Critical — cross-entity (item / pet duplication possible)

- [ ] `Core/src/commands/pet/PetTransferCommand.ts`
- [ ] `Core/src/commands/pet/PetSellCommand.ts`
- [ ] `Core/src/commands/pet/PetFreeCommand.ts`
- [ ] `Core/src/commands/pet/PetExpeditionCommand.ts`
- [ ] `Core/src/commands/pet/PetFeedCommand.ts`
- [ ] `Core/src/core/smallEvents/interactOtherPlayers.ts`

### 4.3 High — guild membership (orphan / duplicate-chief possible)

- [ ] `Core/src/commands/guild/GuildLeaveCommand.ts`
- [ ] `Core/src/commands/guild/GuildKickCommand.ts`
- [ ] `Core/src/commands/guild/GuildInviteCommand.ts`
- [ ] `Core/src/commands/guild/GuildElderCommand.ts`
- [ ] `Core/src/commands/guild/GuildElderRemoveCommand.ts`
- [ ] `Core/src/commands/guild/GuildCreateCommand.ts`
- [ ] `Core/src/commands/guild/GuildDescriptionCommand.ts`
- [ ] `Core/src/core/report/ReportPveService.ts`
- [ ] `Core/src/core/report/ReportCookingService.ts`

### 4.4 Medium — single-player state (XP / health / score lost updates)

- [ ] All `Core/src/core/smallEvents/*.ts` ending in `player.save()`. Sweep via codemod, file-by-file review.
- [ ] `Core/src/core/cooking/CookingService.ts` — already serialised by the cooking menu lock, audit-only.
- [ ] `Core/src/core/missions/MissionsController.ts` — wrap missions update in the player lock.

### 4.5 Out of scope (allow-listed in the ESLint rule)

- All `Core/src/commands/admin/**` test commands — operator-driven.
- GDPR exporters — read-only.
- Cron jobs (`CrowniclesDaily`) — already single-fire.
- `LogsDatabase` — append-only.

## 5. Implementation stages (one PR per stage in the merge train)

Each PR must keep the project green: `pnpm eslint` + `pnpm test` + `pnpm test:integration` (where applicable) all pass.

- [~] **PR-AB — Foundation (lock infra + integration test framework, merged)**
  - [x] `Lib` adds `cls-hooked` dependency
  - [x] `Lib/src/locks/CLSNamespace.ts`: shared CLS namespace + `useCLSOnSequelize(SequelizeCtor)` helper (ctor passed explicitly because pnpm can resolve several physical `sequelize` copies across packages)
  - [x] `Lib/src/locks/withLockedEntities.ts`: generic, model-agnostic API (see §2)
  - [x] Wire `Sequelize.useCLS(...)` in `Lib/src/database/Database.ts` **before** any `new Sequelize(...)` call
  - [x] Add `lockKey()` + `withLocked()` statics to `Player`, `Guild`, `PetEntity`, `Home`
  - [x] Unit tests for `AsyncLock`, `LockManager`, `withLockedEntities` pure logic (sort/dedup/error paths)
  - [x] `Core/package.json`: new `test:integration` script
  - [x] `Core/__tests__-integration/_setup.ts` (DB provisioning helpers)
  - [x] `Core/__tests__-integration/locks/withLockedEntities.integration.test.ts`
        (proves serialisation + rollback on throw + dedup + CLS propagation against real MariaDB — 7/7 green)
  - [x] GitHub Actions workflow `integration-tests.yml` with a `mariadb:11` service
  - [x] `Core/README.md`: how to run integration tests locally
  - [x] No call site is migrated yet — purely additive

- [x] **PR-C — Fix the reported bug**
  - [x] Race integration test for `handleFoodShopBuy`
        (`Core/__tests__-integration/handlers/handleFoodShopBuy.race.test.ts`,
        4 cases: bug demonstrator + 3 lock invariants)
  - [x] Migrate `handleFoodShopBuy` to `Guild.withLocked` — affordability
        + capacity re-validated **inside** the lock so two concurrent
        buyers serialise on the same row instead of both passing a stale
        check.

- [ ] **PR-D — Migrate `handleGuildDomainDepositTreasury`**

- [ ] **PR-E — Migrate critical money/treasury/storage handlers (§4.1)**

- [ ] **PR-F — Migrate cross-entity pet handlers (§4.2)** (pet trade gets a 3-key lock)

- [ ] **PR-G — Migrate guild membership handlers (§4.3)**

- [ ] **PR-H — Sweep medium handlers (§4.4) + ESLint rule + docs**
  - [ ] Codemod (commit-by-commit review) for §4.4
  - [ ] `eslint-custom-rules/no-unguarded-save.mjs` with allow-list
  - [ ] `docs/CONCURRENCY.md` (1-pager)

## 6. Pre-commit checklist (per stage)

- [ ] `pnpm eslint` green in every modified service
- [ ] `pnpm test` green in every modified service
- [ ] `pnpm test:integration` green (from PR-B onwards)
- [ ] Race integration test added for any handler newly migrated
- [ ] No new `xxx.save()` outside a `withLockedEntities` (or allow-listed)
- [ ] **This document** updated in the same commit

## 7. Open questions

*(none currently — all blockers answered by reviewer 2026-05-07: multi-instance target confirmed, `cls-hooked` accepted, integration tests with MariaDB in GitHub Actions confirmed, merge-train delivery confirmed.)*

## 8. Status legend

- [ ] Not started
- [~] In progress
- [x] Done (merged)

---

*Last update: PR-C **complete and green** — `handleFoodShopBuy` now wraps its critical section in `Guild.withLocked` (affordability + capacity re-validated inside the lock). Race integration test (`handleFoodShopBuy.race.test.ts`, 4 cases) demonstrates the lost-update bug on the unsafe variant and the fix on the locked variant. Lib + Core unit + 11/11 integration tests green.*
