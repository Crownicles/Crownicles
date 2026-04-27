# Review TODO — `guildhouse` vs `fixes`

14 commits, +3175 / −506.

---

## Pass 1 — General review

### Overview
Adds a large **Guild Domain** system: per-guild city domain, four upgradeable buildings (shop / shelter / pantry / training ground), treasury auto-funded from score, weekly guild missions with per-member contribution tracking, food-shop access in non-domain cities, daily training-ground love bonus and pantry auto-fill cron jobs, plus full Discord menus. Removes `/magasinguilde`, `/contribuerguilde`, `/queteguilde`, `/domaineguilde` in favour of in-city interactions.

The shape is solid (data-driven missions, single source of truth in [GuildDomainConstants.ts](Lib/src/constants/GuildDomainConstants.ts), proper migration up/down, lock managers around concurrent guild writes).

### Issues

**Correctness / race conditions**
- [ ] [`GuildMissionService.distributeRewards`](Core/src/core/missions/GuildMissionService.ts) is invoked from [`MissionsController.completeAndUpdateMissions`](Core/src/core/missions/MissionsController.ts:198) but is **not protected by `guildMissionLockManager`**, while `updateGuildMission` is. Two members crossing the objective near-simultaneously can both observe `numberDone >= objective`, both enter `distributeRewards`, and double-credit treasury / XP / contribution resets. Wrap the distribute path in the same per-guild lock and re-check `guildMissionId !== null` after acquiring.
- [ ] [`Guild.addScore`](Core/src/core/database/game/models/Guild.ts:269) silently does `this.treasury += parameters.amount` whenever amount > 0. Score can be awarded from many places; confirm none of them are unintended treasury sources, and that score *decreases* don't desync from treasury.
- [ ] [`GuildMissionService.updateGuildMission`](Core/src/core/missions/GuildMissionService.ts) — in the streak `lastDay === today` branch, increments `guildMissionContribution += 1` regardless of `count`. Inconsistent with the non-streak branch which uses `count`.
- [ ] Streak blob assumes `getDayNumber()` returns sequential ints aligned with the daily cron — verify that boundary.

**Schema / migration**
- [ ] `guildMissionId STRING(64)` has no index — fine for now but add one if queried by id later.
- [ ] `guildMissionBlob` as `BLOB` for a 4-byte streak counter is overkill — a small `INT` column would be easier to inspect.

**Code quality**
- [ ] `Lib/src/constants/HelpConstants.ts` and `BlockingConstants.ts` lost entries — grep for stale refs.
- [ ] [`ReportCityGuildDomainShopService`](Core/src/core/report/ReportCityGuildDomainShopService.ts) spends money before saving guild XP; if `addExperience` throws, the player is charged with no XP. Use a transaction or reverse the order.
- [ ] [`BUILDING_LEVEL_FIELDS`](Core/src/core/report/ReportCityGuildDomainService.ts:22) uses `guild[field] as number` (skips Sequelize accessor); prefer `guild.getDataValue`.
- [ ] [`GuildDomainMenu.ts`](Discord/src/commands/player/report/guildDomain/GuildDomainMenu.ts) is 801 lines — split per sub-menu later.
- [ ] `ensureActiveMission` followed immediately by `await guild.save()` in `updateGuildMission` saves even when nothing was generated.

**Tests**
- [ ] No new unit tests for `GuildMissionService` (streak reset, contribution accumulation, reward distribution), `getBuildingUpgradeCost` boundary at maxLevel, or `handleFoodShopBuy` clamping logic.

**Minor**
- [ ] `DOMAIN_PURCHASE_COST = 0` — notary still does `if (guild.treasury < cost)`; harmless when cost is 0.
- [ ] Comments like `// Guild mission completion is handled separately…` and `// Build guild domain data if player has a guild` describe *what*, not *why* — drop per project style.

### Risk assessment
- **Highest:** double-distribution of guild-mission rewards under concurrent updates.
- **Medium:** treasury auto-grow coupled to score side-effects in shared `addScore`.
- **Low:** schema/migration, callsite migration to `getFoodCaps(pantryLevel)`.

---

## Pass 2 — Against `.github/instructions/review-checklist.instructions.md`

### 1. Magic Strings & Constants
- [ ] **Magic strings as error codes** — [`ReportCityGuildDomainService.ts`](Core/src/core/report/ReportCityGuildDomainService.ts), [`ReportCityFoodShopService.ts`](Core/src/core/report/ReportCityFoodShopService.ts), [`ReportCityGuildDomainShopService.ts`](Core/src/core/report/ReportCityGuildDomainShopService.ts) use raw strings (`"noGuild"`, `"noShop"`, `"notEnoughTreasury"`, `"maxLevel"`, `"invalidBuilding"`, `"notAuthorized"`, `"storageFull"`, `"cannotBuy"`, `"invalidFood"`, `"notEnoughMoney"`, `"invalidTier"`). Extract to `as const` objects (e.g., `GUILD_DOMAIN_ERRORS.NO_GUILD`).
- [ ] **Magic tier strings** — [`ReportCityGuildDomainShopService.ts`](Core/src/core/report/ReportCityGuildDomainShopService.ts) uses `"small"` / `"big"` for XP tiers. Extract to a const enum / tagged object.
- [ ] **Magic numbers** — `Math.floor(guild.level / 50)` in [`GuildMissionService.generateMission`](Core/src/core/missions/GuildMissionService.ts) — `50` should be a named constant (`GUILD_LEVEL_PER_OBJECTIVE_TIER` or similar in `GuildDomainConstants`).
- [ ] **Magic indices into food arrays** — `foodCaps[2]` (herbivorous), `foodCaps[3]` (ultimate), `foodCaps[0]` (common) appear in [`farmer.ts`](Core/src/core/smallEvents/farmer.ts), [`ultimateFoodMerchant.ts`](Core/src/core/smallEvents/ultimateFoodMerchant.ts), [`GuildDailyCommand.ts`](Core/src/commands/guild/GuildDailyCommand.ts:209). Use `getFoodIndexOf(PetConstants.PET_FOOD.HERBIVOROUS_FOOD)` consistently.
- [ ] **Pre-compute derived constants** — `GUILD_MISSIONS.DURATION_HOURS = 168` is converted with `hoursToMilliseconds` at every call. Define `DURATION_MS = 168 * 3_600_000` directly per checklist guidance.
- [ ] **Constants in right location** — `XP_TIERS` map in [`ReportCityGuildDomainShopService.ts`](Core/src/core/report/ReportCityGuildDomainShopService.ts) wraps `GuildDomainConstants.SHOP_PRICES.SMALL_XP/BIG_XP`. Move the tier→price mapping to `GuildDomainConstants` itself.

### 2. TypeScript Types
- [ ] **Raw `string` instead of derived union** — `building!: string` in `CommandReportGuildDomainUpgradeReq`, `foodType!: string` in `CommandReportFoodShopBuyReq`, `tier!: string` in `CommandReportGuildDomainBuyXpReq`, `error!: string` in all `*ErrorRes`. These should be `GuildBuilding`, `PetFood`, `XpTier`, and a derived error-code union respectively.
- [ ] **Unnecessary type assertion** — `foodType as typeof PetConstants.PET_FOOD_BY_ID[number]` in [`ReportCityFoodShopService.ts`](Core/src/core/report/ReportCityFoodShopService.ts).
- [ ] **`as const` on nested arrays** — `SHOP_PRICES.FOOD: [20, 250, 250, 600]` is not `as const` (only the outer wrapper at top-level objects is). Inconsistent with `PANTRY_FOOD_CAPS` and `SHELTER_SLOTS` which use `as const`.
- [ ] **`as Guilds`** in [`GuildStorageCommand.ts`](Core/src/commands/guild/GuildStorageCommand.ts) — `guild[foodKey as keyof Guilds]` looks suspect (`Guilds` is the repository, not the model — likely should be `keyof Guild`).
- [ ] **`Buffer | null` for streak day** — should be a small int field (also a schema issue).

### 3. Code Complexity
- [ ] **`GuildDomainMenu.ts` 801 lines** — explicit checklist violation. Split per sub-menu (main / upgrade / shop / shelter / pantry / training).
- [ ] **`ReportCommand.sendCityCollector`** now builds three more inline data objects (`guildDomain`, `guildDomainNotary`, `guildFoodShop`). Extract `buildGuildDomainData(player, city)` helper.
- [ ] **`generateReward` in [`ultimateFoodMerchant.ts`](Core/src/core/smallEvents/ultimateFoodMerchant.ts)** — nested ternary `bool() ? (cap ? A : B) : C` is exactly the "Bumpy Road" pattern.
- [ ] **`updateGuildMission` does too many things** — lock acquire, ensure mission, validate, streak handling, increment, save, return-completion. Split into `getMatchingActiveMission` + `applyContribution`.
- [ ] **Repeated guard `if (!player.guildId)`** appears in every service handler. Consider a shared early-guard helper.

### 4. Imports & Module Organization
- [x] No dynamic imports detected.
- [x] No duplicate imports detected in the diff.

### 5. Code Duplication
- [ ] **`guild.getDataValue(foodType)`** read pattern repeated across `addFood`, `isStorageFullFor`, `handleFoodShopBuy`, `CookingService.getAvailableFoodSpace`. Domain method `Guild.getFoodAmount(foodType)` would centralize it.
- [ ] **Guild domain data `food: { common, carnivorous, herbivorous, ultimate }`** literal appears in both `guildDomain` and `guildFoodShop` blocks of [`ReportCommand.ts`](Core/src/commands/player/ReportCommand.ts) — extract a `pickFood(guild)` helper.
- [ ] **Same `if (!player || !player.guildId)` + `Guilds.getById` + chief check** trio in [`ReportCityGuildDomainService.ts`](Core/src/core/report/ReportCityGuildDomainService.ts) and [`ReportCityGuildDomainShopService.ts`](Core/src/core/report/ReportCityGuildDomainShopService.ts).
- [ ] **Domain logic on the model** — `GuildDomainConstants.getShelterSlots(guild.shelterLevel)` is called from many sites; would be cleaner as `guild.getShelterCapacity()` / `guild.getFoodCaps()`.

### 6. Translations (i18n)
- [ ] **Non-French translations modified** — `Lang/de/`, `Lang/es/`, `Lang/it/`, `Lang/pt/` `commands.json`, `discordBuilder.json`, `error.json` are edited to delete removed-command keys. Per checklist "Only modify French translations", deletions in non-FR should also be left to Crowdin sync. (Less critical than additions but still drift.)
- [ ] **`Lang/en/commands.json` got 39 added lines** — verify EN is treated as source-of-truth in this repo; if not, additions belong only to FR.
- [ ] **Verify removed keys are unreferenced** — `commands.guildShop.*`, `error.commandsBlocked.guildShop`, `error.commandsBlocked.guildShopConfirmation` removed; grep all source for residual usage.
- [ ] **Emojis in i18n** — verify new `commands:report.city.guildDomain.*` entries use `{emote:path}` interpolation, no hardcoded characters.

### 7. Dead Code & Cleanup
- [ ] **`GuildShopConstants.ts`** retained while `GuildShopCommand.ts` (Core+Discord) and `CommandGuildShopPacket.ts` are deleted — confirm `GuildShopConstants` is still referenced (the diff redirects callers to `GuildDomainConstants`). If unused, remove.
- [ ] **`GuildConstants.MAX_PET_FOOD` / `MAX_HERBIVOROUS_PET_FOOD` / `MAX_ULTIMATE_PET_FOOD` / `MAX_COMMON_PET_FOOD`** — all callsites migrated to `GuildDomainConstants.getFoodCaps`. Remove the dead constants from `GuildConstants` if no remaining refs.
- [ ] **Comment churn** — explanatory comments like `// Guild mission completion is handled separately via GuildMissionService.distributeRewards` describe *what*; drop.
- [ ] **`// Build guild domain data if player has a guild`** style comments in [`ReportCommand.ts`](Core/src/commands/player/ReportCommand.ts) — same.

### 8. ESLint & Style
- [ ] Run `pnpm eslint` in Core, Discord, Lib — not verified here.
- [ ] **`async` without `await`** — quick scan didn't reveal any, but worth verifying handler stubs.
- [ ] **`// eslint-disable-line new-cap`** comment repeats on every `STRING(64)` — fine but consider why your model & migration patterns hit this so often.

### 9. Tests
- [ ] **No new tests added for new logic** — `GuildMissionService`, `GuildDomainConstants.getBuildingUpgradeCost` (max-level boundary), `handleFoodShopBuy` clamping, notary purchase/relocation flow. Checklist explicitly calls for coverage on new utilities and data transformations.
- [ ] **Test count must not drop** — verify `pnpm test` count vs `fixes` baseline.

---

## Suggested merge gate
1. Add lock + idempotency around `distributeRewards`.
2. Convert error-code / building / tier strings to `as const` unions.
3. Split `GuildDomainMenu.ts`.
4. Add `GuildMissionService` + clamping unit tests.
5. Revert non-FR `Lang/*` deletions and let Crowdin sync.
6. Remove dead constants in `GuildConstants` / `GuildShopConstants` if fully replaced.
