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

- [x] `Core/src/core/report/ReportCityFoodShopService.ts` — `handleFoodShopBuy` (the original bug, PR-C)
- [x] `Core/src/core/report/ReportCityGuildDomainShopService.ts` — `handleGuildDomainDepositTreasury` (PR-D, 2-key Player+Guild lock)
- [x] `Core/src/core/report/ReportCityGuildDomainService.ts` — `handleGuildDomainNotaryReaction` + `handleGuildDomainUpgrade` (PR-E1, Guild.withLocked)
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

- [x] `Core/src/commands/pet/PetTransferCommand.ts`
- [x] `Core/src/commands/pet/PetSellCommand.ts`
- [x] `Core/src/commands/pet/PetFreeCommand.ts`
- [x] `Core/src/commands/pet/PetExpeditionCommand.ts`
- [x] `Core/src/commands/pet/PetFeedCommand.ts`
- [x] `Core/src/core/smallEvents/interactOtherPlayers.ts`

### 4.3 High — guild membership (orphan / duplicate-chief possible)

- [x] `Core/src/commands/guild/GuildLeaveCommand.ts`
- [x] `Core/src/commands/guild/GuildKickCommand.ts`
- [x] `Core/src/commands/guild/GuildInviteCommand.ts`
- [x] `Core/src/commands/guild/GuildElderCommand.ts`
- [x] `Core/src/commands/guild/GuildElderRemoveCommand.ts`
- [x] `Core/src/commands/guild/GuildCreateCommand.ts`
- [x] `Core/src/commands/guild/GuildDescriptionCommand.ts`
- [x] `Core/src/core/report/ReportPveService.ts`
- [x] `Core/src/core/report/ReportCookingService.ts`

### 4.4 Medium — single-player state (XP / health / score lost updates)

- [x] All `Core/src/core/smallEvents/*.ts` ending in `player.save()`. **PR-H1**: synchronous small events covered uniformly via a `Player` row lock wrapped around `loadAndExecuteSmallEvent` (no per-file edit). **PR-H2**: per-file lock inside the deferred end-callback for collector-based small events via the shared `withLockedPlayerSafe(player, context, body)` helper applied to `cart`, `lottery`, `altar`, `witch`, `limoges`, `Shop.ts`, `fightPet`, `petFood`, `gardener` (paid seed), `gobletsGame`, `goToPVEIsland`. `badPet.ts` does not mutate `player` (only `petEntity` / `guild`) so the inner mission updates inherit PR-H1's `MissionsController` lock and no per-file lock is required.
- [x] `Core/src/core/cooking/CookingService.ts` — audited, already serialised by the cooking menu lock.
- [x] `Core/src/core/missions/MissionsController.ts` — `update()` runs under `withLockedEntities([Player, PlayerMissionsInfo])` with re-fetch and graceful `LockedRowNotFoundError` no-op.

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

- [x] **PR-D — Migrate `handleGuildDomainDepositTreasury`**
  - [x] Race integration test
        (`Core/__tests__-integration/handlers/handleGuildDomainDepositTreasury.race.test.ts`,
        4 cases: bug demonstrator on the in-process `LockManager`
        variant + 3 lock invariants)
  - [x] Migrate `handleGuildDomainDepositTreasury` to a 2-key composite
        lock (`withLockedEntities([Guild.lockKey, Player.lockKey], …)`).
        `player.money` is re-validated **inside** the lock against the
        freshly-loaded row, and `LockManager` is removed from the
        handler.

- [ ] **PR-E — Migrate critical money/treasury/storage handlers (§4.1)**
  - [x] **PR-E1 — Guild treasury upgrades**
        (`handleGuildDomainNotaryReaction` + `handleGuildDomainUpgrade`
        wrapped in `Guild.withLocked`, race integration test
        `handleGuildDomainTreasuryUpgrades.race.test.ts` with 4 cases)
  - [x] **PR-E2 — Player money/tokens sinks (Inn, TokenHeal,
        Blacksmith)** — `handleInnMealReaction`,
        `handleInnRoomReaction`, `acceptUseTokens`, `acceptBuyHeal`,
        `handleBlacksmithUpgradeReaction`,
        `handleBlacksmithDisenchantReaction` now wrap their
        read-validate-spend-save critical section in
        `Player.withLocked(...)` with in-lock re-validation of
        `money`/`tokens`/`canEat`/`canHealAlteration`. Race
        integration test
        (`__tests__-integration/handlers/playerMoneySinks.race.test.ts`,
        4 cases) demonstrates the generic lost-update bug and the fix.
  - [x] **PR-E3 — Enchanter (Player + PlayerMissionsInfo) + Home
        (Player + Home, multi-row)** — `enchantItem`,
        `handleBuyHomeReaction`, `handleUpgradeHomeReaction`,
        `handleMoveHomeReaction` now wrap their critical sections in
        `withLockedEntities([Player.lockKey, …])` (or
        `Player.withLocked` for buy-home which only mutates the
        wallet plus an idempotent home create). New
        `PlayerMissionsInfo.lockKey` / `PlayerMissionsInfo.withLocked`
        statics. Race integration test
        (`__tests__-integration/handlers/playerAuxiliarySinks.race.test.ts`,
        4 cases) demonstrates the multi-row lost-update bug and the
        fix.

- [ ] **PR-F — Migrate cross-entity pet handlers (§4.2)** (pet trade gets a 3-key lock)
  - [x] **PR-F1 — `PetTransferCommand` (deposit / withdraw / switch)** with `LockedRowNotFoundError → SituationChanged`
  - [x] **PR-F2 — `PetSellCommand`** (4-row trade: seller + buyer + pet + guild)
  - [x] **PR-F3 — `PetFreeCommand`** (own-pet free: 2/3-row, shelter free: 4-row)

- [ ] **PR-G — Migrate guild membership handlers (§4.3)**

- [x] **PR-H — Sweep medium handlers (§4.4) + ESLint rule + docs**
  - [x] §4.4 sweep — split into **PR-H1** (orchestration-level locks — `MissionsController.update` + `loadAndExecuteSmallEvent` wrapper covering all synchronous small events uniformly + cooking audit) and **PR-H2** (per-file lock inside the deferred end-callback for collector-based small events: `cart`, `lottery`, `altar`, `witch`, `limoges`, `Shop.ts`, `fightPet`, `petFood`, `gardener` (paid seed), `gobletsGame`, `goToPVEIsland`, plus race integration tests)
  - [x] `eslint-custom-rules/no-unguarded-save.mjs` with allow-list
  - [x] `docs/CONCURRENCY.md` (1-pager)

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

*Last update: PR-F4 **complete and green** — bundled migration of the three remaining §4.2 cross-entity pet flows. (1) `PetExpeditionCommand.doResolveExpedition` now locks `[Player, PetEntity]` around the entire effect chain (calculate outcome → apply love change → apply expedition rewards → finalize / clean up scheduled notification + pet expedition row → mission updates → badge award), with in-lock revalidation that the active expedition row still exists and the player still owns the same pet, so two concurrent resolutions can never double-credit rewards or mutate a destroyed pet. (2) `PetFeedCommand` end-callbacks now lock `[Player, PetEntity]` (no-guild candy flow) or `[Player, PetEntity, Guild]` (guild pantry flow) and revalidate `player.petId === authorPet.id` plus money/pantry availability against the locked rows, so a concurrent pet-free / sell / transfer / shop-buy can no longer strand the feed on a destroyed row or drain the pantry under us. (3) `interactOtherPlayers.sendACoin` now locks `[Player(donor), Player(beggar)]` and revalidates `donor.money >= 1` against the locked rows, so two concurrent SE invocations against a single-coin donor can no longer mint a phantom coin. Helpers `applyLockedResolveExpedition` / `applyLockedCandyFeed` / `applyLockedGuildFeed` / `applyLockedShelterFree` keep complexity below CodeScene threshold. Race integration test (`petFeedExpeditionInteract.race.test.ts`, 7 cases — 3 bug demos for lost-update on candy feed / expedition reward / phantom coin minting, 4 fix demos including ownership-changed-mid-flight) protects against all three cross-entity footguns. Core 1006/1006 unit + 43/43 integration, Lib 547/547. §4.2 fully checked off. Next: §4.3 (Guild membership) — start with `GuildLeaveCommand` / `GuildKickCommand` / `GuildCreateCommand`.* — `PetFreeCommand` now wraps the trade critical section in `withLockedEntities([Player(seller), Player(buyer), PetEntity, Guild])` with in-lock revalidation of every actor's invariants (seller still owns pet & guild; buyer still petless, in a different guild, with enough money). The buyer money debit, pet ownership swap, love-points reset, and guild treasury credit now commit atomically in a single TX. Helper `applyLockedPetSell` keeps `executePetSell` cyclomatic complexity below CodeScene threshold. Race integration test (`petSell.race.test.ts`, 3 cases — 4-row duplication-bug demo, lock-serialised invariant, parallel non-blocking sales) protects against the cross-guild pet-duplication footgun. Core 1006/1006 unit + 33/33 integration, Lib 547/547. Next: PR-F3 (PetExpedition + PetFreeCommand + PetFeedCommand + interactOtherPlayers).* — `PetTransferCommand` deposit / withdraw / switch flows now wrap their cross-entity critical sections in `withLockedEntities([Player.lockKey, Guild.lockKey | GuildPet.lockKey])` with in-lock revalidation of `petId`, `shelterLevel` capacity, and `guildPet.petEntityId`. Added `GuildPet.lockKey` / `GuildPet.withLocked` statics, plus a new `LockedRowNotFoundError` class so concurrent destroys map gracefully to `CommandPetTransferSituationChangedErrorPacket` instead of an internal-server error. Race integration test (`petTransfer.race.test.ts`, 3 cases — duplication-bug demo + lock-serialised invariant + non-blocking parallel slots) protects against the pet-duplication footgun. Core 1006/1006 unit + 30/30 integration, Lib 547/547. Next: PR-F2 (PetSell + PetExpedition).*1006 unit + 27/27 integration tests green. §4.1 sweep complete; mission shops & shop utils remain for a future PR (likely §4.4 sweep or PR-H).*

*Last update: PR-G **complete and green** — bundled §4.3 (Guild membership) sweep covering 7 commands + 2 services + race tests. (1) `GuildLeaveCommand` locks `[Player(self), Guild]` (or 3-key `[Player(self), Player(elder), Guild]` when the chief leaves with an elder) and revalidates membership / chief role / elder presence in-lock so a concurrent kick + leave cannot leave the guild headless or promote a since-departed elder. (2) `GuildKickCommand` locks `[Player(chief), Player(kicked), Guild]` and revalidates chief role + kicked-still-member in-lock. (3) `GuildInviteCommand` locks `[Player(invited), Guild]` and recomputes member count under the guild lock so two concurrent acceptances can never overflow `MAX_GUILD_MEMBERS`. (4) `GuildElderCommand` / `GuildElderRemoveCommand` lock the chief + (de)promoted player + guild and revalidate the chief role + target's role in-lock. (5) `GuildCreateCommand` locks `[Player(self)]` and revalidates `guildId === null` + `money >= price` + name uniqueness in-lock so a double-click cannot debit twice or create twin guilds. (6) `GuildDescriptionCommand` locks `[Player(self), Guild]` and revalidates the chief-or-elder role in-lock so a since-demoted elder's stale-snapshot edit cannot land. (7) `ReportPveService.applyGuildRewards` wraps the addScore + addExperience + save sequence in `withLockedEntities([Guild])` so two concurrent PVE rewards from different guild members cannot lose increments; player-side rewards stay outside the lock since `BlockingUtils` enforces single-flight per player. (8) `ReportCookingService.handlePetFoodOutput` extracts a `runPetFoodOutputUnderLock` helper that locks the guild, recomputes available pantry space against the freshly-read row, and saves; surplus computation flows from the locked outcome's `storedQuantity` so two concurrent cookings cannot overshoot the food cap. All `LockedRowNotFoundError` paths route to a coherent user-facing error packet (or, for the services, to a graceful no-guild reward / full-surplus output). Race integration test (`guildMembership.race.test.ts`, 8 cases — 4 bug demos for invite overflow / chief-promotes-stale-elder / double-create-double-debit / demoted-elder-stale-edit, 4 fix demos including the 3-key chief-leave-while-elder-leaves coordination) protects every membership flow. Core 1006/1006 unit + 51/51 integration, Lib 547/547. §4.3 fully checked off. Next: §4.4 (single-player state — `smallEvents/*.ts` sweep + `MissionsController`).*

*Last update: PR-H1 **opened** — first half of §4.4 (single-player state). Two orchestration-level changes that uniformly cover the simple-case fan-out without a per-file edit per small event. (1) `MissionsController.update` now runs under `withLockedEntities([Player, PlayerMissionsInfo])`: the body is moved into a private `runUpdateUnderLock` helper that operates on the freshly re-fetched locked instances, so the daily-mission counter, streak bookkeeping, mission-slot completion + reward credit (XP / money / score / gems) all commit atomically in a single TX. `LockedRowNotFoundError` is treated as a benign warn-and-skip (player or mission info row destroyed concurrently, e.g. by `/reset`). (2) `ReportSmallEventService.loadAndExecuteSmallEvent` now wraps `smallEvent.executeSmallEvent` + `MissionsController.update` in a single `Player.lockKey`-scoped `withLockedEntities`: the locked player instance is passed to the small event implementation so any synchronous mutation it performs runs against the locked row, inheriting the surrounding TX through cls-hooked. This protects every small event whose mutations land synchronously in `executeSmallEvent` (`winHealth`, `winEnergy`, `winPersonalXP`, `smallBad`, `winGuildXP`, `findItem`, `findMaterial`, `gardener`, `pet`, `goToPVEIsland`, `space`, `expeditionAdvice`, …) without touching any of the small-event files individually. Small events that defer their write to a collector end-callback (`lottery`, `gobletsGame`, `witch`, `cart`, `badPet`, `ultimateFoodMerchant`, `fightPet`, `Shop.ts`) only acquire the lock for their setup phase here — their deferred callback re-locks itself in PR-H2 alongside the race integration tests. `CookingService` was audited and confirmed already serialised by the cooking menu lock + per-action `BlockingUtils` (no code change required). Core 1006/1006 unit pass; integration tests deferred to PR-H2 with the per-collector-SE work. Next: PR-H2 (collector small events + race tests).*

*Last update: PR-H2 **opened** — second half of §4.4 (single-player state). Closes the gap left by PR-H1 for collector-based small events whose state mutations land inside a deferred `EndCallback` that fires after the outer `loadAndExecuteSmallEvent` lock has been released. New shared helper `Core/src/core/utils/withLockedPlayerSafe.ts` wraps `withLockedEntities([Player.lockKey(player.id)])` and treats `LockedRowNotFoundError` as a benign warn-and-skip (player row destroyed concurrently — e.g. by `/reset`). Migrated 11 collector small events to delegate their endCallback body to the locked instance: `cart` (mission update under lock), `lottery` (level + hard-mode money check re-evaluated against `lockedPlayer.money`), `altar` (money + spend + blessing + bonus rewards + badge + mission), `witch` (replaces the manual `player.reload()` with proper FOR UPDATE semantics), `limoges` (favorable XP/score and unfavorable health/money penalties), `interfaces/Shop.ts` (re-evaluates `canBuy` so two concurrent shop accepts cannot drive the player into debt), `fightPet` (rage delta), `petFood` (investigate / send-pet / continue handlers + `applyOutcome` recipe-discovery payment), `gardener.getPaidSeedEndCallback` (seed cost re-evaluated against locked money), `gobletsGame.applyMalus` (energy / health / money / item drop), `goToPVEIsland` (gems gate re-evaluated; refuse / no-answer branches return before locking to avoid spurious lock acquisition). `badPet.ts` was audited: its handlers only mutate `petEntity` / `guild` and the inner `petEntity.changeLovePoints` mission update inherits PR-H1's `MissionsController.update` lock — no direct player lock needed. Race integration test (`singlePlayerSinks.race.test.ts`, 4 cases — stale-snapshot bug demo where a broke player overspends to negative money, lock-fixed re-evaluation against the fresh row, two concurrent end-callbacks serialised on a one-purchase budget, distinct players never blocked) protects the deferred-end-callback shape. Core 1006/1006 unit + 56/56 integration, Lib 547/547 unchanged. §4.4 now fully checked off. Next: ESLint `no-unguarded-save` rule + `docs/CONCURRENCY.md` 1-pager.*

*Last update: PR-H2 **follow-up** — ESLint regression rule + 1-pager doc landed. `crownicles/no-unguarded-save` (`eslint-custom-rules/no-unguarded-save.mjs`, ~165 LOC) is a syntactic AST rule that flags any `<expr>.save()` not lexically inside a `withLockedEntities` / `withLockedPlayerSafe` / `<Model>.withLocked` callback or a function whose name ends in `UnderLock`. Scope is intentionally narrow in `Core/eslint.config.mjs` — only the orchestration files where regression risk is highest (`MissionsController`, `ReportSmallEventService`, `ReportPveService`, `ReportCookingService`, `withLockedPlayerSafe`); leaf files are protected at the call site. Twelve audited legacy saves opted out with `// eslint-disable-next-line crownicles/no-unguarded-save -- <justification>` (mostly "reached only from runUpdateUnderLock chain", "fresh INSERT", or "single-field UI preference"). One TODO surfaced: `ReportPveService` player-side reward `.save()` is not yet under a lock — guild-side already covered in PR-G — flagged as `TODO(concurrency)` in code, deferred to a future sweep. `docs/CONCURRENCY.md` is the contributor-facing primer (lost-update problem statement, the three lock helpers, `*UnderLock` naming convention, the lint rule + how to opt out with justification, when to add a race integration test). Core 1006/1006 unit + 56/56 integration, eslint clean. All PR-H sub-items now `[x]`.*
