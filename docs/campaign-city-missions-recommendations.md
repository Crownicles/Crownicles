# Campaign Balance Analysis — Integrating the New City Missions (PR #4331)

> **Scope:** This document analyses the state of the mission **campaign** (`Core/resources/campaign.json`) and recommends how to integrate the 22 new "city‑life" missions introduced by PR #4331 (issue #4118 / #4331). It is a *recommendation + balance* document. A **draft implementation** (campaign edit + migration) was also produced on the branch `campaign-city-missions-proposal` to save implementation time — it is optional and disposable.
>
> **Author:** automated analysis pass. **Date:** 2026‑06‑30.

---

## 1. TL;DR (read this first)

1. **PR #4331 added 22 new mission definitions but never touched `campaign.json`.** All 22 currently live only in the daily/random mission pool *or nowhere at all*.
2. **15 of the 22 are `campaignOnly: true`.** A `campaignOnly` mission can **never** be drawn as a daily/random mission. Because they are not referenced in `campaign.json` either, **these 15 missions are currently dead content — unreachable by any player.** This is the single most important finding.
3. The campaign has **no "home / city‑life" thematic arc at all today** (the visualizer shows 0 missions in a domestic category — closest is "Économie" and "PNJ"). The new missions are a natural, currently‑missing progression layer (buy a home → furnish it → upgrade it → garden/cook → real‑estate empire).
4. **Recommendation:** add the **15 `campaignOnly` missions** to the campaign as a threaded "city‑life" arc (mandatory — they are otherwise dead), and **optionally** seed **5–7** of the daily‑pool city missions as first‑time milestones.
5. A **verified migration** (positions + completed‑player handling) is included. The insertion math was checked with the project's own simulation algorithm — `simulate_migration(129, positions)` reproduces the exact new‑mission positions.

---

## 2. Method & tools used

| Step | Tool | Result |
|------|------|--------|
| Recent history | `git log` / `git show` on last 15 commits | Found PR #4331 commits `964ccd72e` (5 missions) + `f641111ef` (12 missions) |
| Diff vs `master` | `git diff --name-status master..HEAD` | 22 new mission JSON files added; **`campaign.json` unchanged vs master** |
| Campaign state | Python dump of `campaign.json` | 129 missions, 76 distinct ids |
| Visualizer | Chrome MCP → [campaign‑visualizer](https://crownicles.github.io/Tools/generators/campaign-visualizer.html), uploaded local `campaign.json` + `models.json` | Confirmed **129 missions, 76 types, 💎537 total gems, ⭐23 125 total XP**; category split below |
| Mechanics | 3 parallel research sub‑agents (home/apartment, garden/cooking, blacksmith/guild/NPC) | Per‑mission trigger, prerequisites, difficulty, variants |
| Migration math | Project's `simulate_migration` + `addCampaignMissionList` source | Verified insertion positions |

> Note: the visualizer flagged "Traductions FR ❌" — that is a path/shape mismatch in the tool's loader, **not** a missing‑translation problem. All 22 missions have valid FR strings in `Lang/fr/models.json` (verified directly).

### 2.1 Current campaign category distribution (from the visualizer)

| Category | Count |
|---|---|
| 📈 Progression | 22 |
| 🧭 Voyage | 16 |
| ⚔️ Combat | 16 |
| 💰 Économie | 13 |
| 🧪 Potions | 11 |
| 🗺️ Expédition | 11 |
| 📋 Autre | 10 |
| 👤 PNJ | 10 |
| 🏰 Guilde | 8 |
| 🐾 Familier | 8 |
| 🎫 Jetons | 4 |
| 🏠 **City / Home life** | **0 ← the gap** |

---

## 3. How the campaign maps to player progression

The campaign is a flat ordered list; difficulty is encoded by *position*. The cleanest anchors are the `reachLevel` missions, which let us map any campaign position to an approximate player level:

| Campaign pos | Anchor mission | ≈ Player level |
|---|---|---|
| 5 | `reachLevel 5` | 5 |
| 7 | `chooseClass` | ~8 |
| 13 | `reachLevel 8` | 8 |
| 16 | `reachLevel 10` | 10 |
| 20 | `joinGuild` | ~15 |
| 22 | `reachLevel 20` | 20 |
| 28 | `havePet` (first pet) | ~22 |
| 42 | `doExpeditions` (first) | ~35 |
| 47 | `reachLevel 40` | 40 |
| 71 | `reachLevel 60` | 60 |
| 93 | `reachLevel 80` | 80 |
| 124 | `reachLevel 100` | 100 |

This mapping is the backbone for placing each city mission next to the moment its prerequisites unlock.

---

## 4. The 22 new missions — full catalog

`CO` = `campaignOnly` flag in the mission JSON.
**`CO:true` ⇒ the mission can ONLY appear in the campaign.** If it is not in `campaign.json` it is unreachable.

### 4.1 Home & real‑estate (notary / home service)

| Mission | CO | Trigger | Prerequisite | Difficulty | Variant |
|---|---|---|---|---|---|
| `buyHome` | ✅ true | Buy first home at notary | reach a city, ~1 000 coins | early | none |
| `depositChestItem` | ✅ true | Deposit an item in the home chest | owns a home | early | none |
| `upgradeHomeLevel` | ✅ true | Upgrade home one level | home + player‑level gate (L2→15, L3→30, L5→60, L8→120) + coins (3.5k→250k) | scales | **variant = required level (2–8)** |
| `buyApartment` | ✅ true | Buy an apartment (per city) | **must already own a home** | mid | none |
| `buyAllApartments` | ✅ true | Own an apartment in every apartment city | all apartment cities visited + bought | end‑game | none |
| `collectRent` | ✅ true | Claim rent at notary | owns a rented apartment, ≥100 coins accrued (212/day) | mid | none |

### 4.2 Inn (sleep / meal / heal)

| Mission | CO | Trigger | Prerequisite | Difficulty | Variant |
|---|---|---|---|---|---|
| `sleepInInn` | ✅ true | Rent an inn room | in any city (inns are everywhere) | early | none |
| `healInBed` | ❌ false | Heal in a bed (home **or** inn), 24h cooldown | in a city | early | none |
| `innMeal` | ❌ false | Eat a meal at the inn | in a city, meal cooldown | early | none |

### 4.3 Blacksmith / enchanter

| Mission | CO | Trigger | Prerequisite | Difficulty | Variant |
|---|---|---|---|---|---|
| `upgradeItem` | ✅ true | Upgrade a weapon/shield at the blacksmith | item + materials/coins | early‑mid | none |
| `upgradeEpicItemLevel5` | ✅ true | Upgrade an **epic+** weapon/shield to **level 5** | epic+ item + home L5 (level‑2 upgrades) + materials/gems | **late** | none |
| `enchantItem` | ✅ true | Enchant a weapon/shield | item + coins/gems | mid | none |

### 4.4 Garden / cooking / materials (home L2+)

| Mission | CO | Trigger | Prerequisite | Difficulty | Variant |
|---|---|---|---|---|---|
| `cultivatePlants` | ❌ false | Harvest garden plants | home L2 (garden plots, lvl 15) | mid | none |
| `cultivateAncestralTrees` | ✅ true | Harvest the ancestral tree (PlantId 10) | garden + ancestral seed (gardener NPC, late) | **late** | none |
| `haveGardenTalisman` | ✅ true | Own the Remote‑Harvest Talisman | garden unlocked + 2 450 coins | mid | none |
| `cookRecipes` | ❌ false | Complete a cooking recipe | home L2 (cooking slot) + ingredients | mid | none |
| `collectMaterials` | ❌ false | Collect materials (compost / boss / events) | rarity‑gated | mid | **variant = material rarity (1–3)** |

### 4.5 Guild domain / food shop

| Mission | CO | Trigger | Prerequisite | Difficulty | Variant |
|---|---|---|---|---|---|
| `joinGuildHouse` | ✅ true | Be in a guild that owns a domain | guild + claimed domain | mid | none |
| `depositGuildTreasury` | ❌ false | Deposit into the guild treasury | guild + domain | mid | none |
| `buyGuildPetFood` | ❌ false | Buy pet food at the guild food shop | guild + shop ≥ L1 + a pet | mid | none |

### 4.6 City NPCs / misc

| Mission | CO | Trigger | Prerequisite | Difficulty | Variant |
|---|---|---|---|---|---|
| `visitCityNpc` | ✅ true | Visit a specific city shop NPC | in a city with that shop | early | **variant = NPC (1 royalMarket … 8 materialMerchant)** |
| `replaceMission` | ✅ true | Replace a mission via the mission shop | gems | early | none |

**`campaignOnly: true` set (15, must be placed):** `buyHome`, `depositChestItem`, `upgradeHomeLevel`, `buyApartment`, `buyAllApartments`, `collectRent`, `sleepInInn`, `upgradeItem`, `upgradeEpicItemLevel5`, `enchantItem`, `cultivateAncestralTrees`, `haveGardenTalisman`, `joinGuildHouse`, `visitCityNpc`, `replaceMission`.

**`campaignOnly: false` set (7, already in daily pool, optional to also seed in campaign):** `healInBed`, `innMeal`, `cultivatePlants`, `cookRecipes`, `collectMaterials`, `depositGuildTreasury`, `buyGuildPetFood`.

---

## 5. Recommended placement — the 15 mandatory missions

Design principle: introduce each city feature **right after the player can first do it**, building one coherent "settle in the world" arc (home → furnish → inn/blacksmith → upgrade/enchant → garden → real estate → end‑game prestige). Rewards follow the local gem/XP curve of their neighbours.

| Final pos | Mission | Variant | 💎 | ⭐ | ≈ level | Rationale |
|---:|---|---|---:|---:|---|---|
| 11 | `buyHome` | – | 2 | 40 | ~8 | Right after reaching **Le Berceau** (pos 10); home costs ~1 000 coins, affordable by now. Opens the whole arc. |
| 12 | `depositChestItem` | – | 1 | 25 | ~8 | Immediately teaches the home chest. |
| 15 | `sleepInInn` | – | 1 | 25 | ~9 | Inns are available everywhere; gentle early task. |
| 16 | `visitCityNpc` | 2 (generalShop) | 1 | 30 | ~10 | Teaches city shops; generalShop exists in every city. |
| 22 | `upgradeItem` | – | 2 | 50 | ~12 | Blacksmith intro once the player has gear + a few materials. |
| 23 | `replaceMission` | – | 1 | 25 | ~13 | Teaches the mission shop / reroll. |
| 29 | `upgradeHomeLevel` | **2** | 2 | 75 | ~15–20 | First home upgrade unlocks at player level 15 (garden + cooking + bigger chest). |
| 34 | `enchantItem` | – | 2 | 75 | ~22 | Enchanter; sits next to `chooseClassTier`. |
| 44 | `buyApartment` | – | 3 | 100 | ~30 | Requires owning a home (✓ since pos 11); first real‑estate expansion. |
| 45 | `collectRent` | – | 2 | 75 | ~30 | Natural follow‑up: collect the apartment's rent. |
| 57 | `joinGuildHouse` | – | 3 | 150 | ~40 | After the guild block (`joinGuild` 20, `guildDaily` 46) once a domain exists. |
| 62 | `haveGardenTalisman` | – | 3 | 150 | ~45 | Garden is established by now; 2 450‑coin convenience purchase. |
| 113 | `cultivateAncestralTrees` | – | 5 | 300 | ~60+ | Late: requires the ancestral seed unlocked via the gardener storyline. |
| 120 | `upgradeEpicItemLevel5` | – | 6 | 350 | ~60+ | Late: needs an epic+ item upgraded to L5 (home L5 + materials/gems). |
| 140 | `buyAllApartments` | – | 12 | 400 | ~95+ | End‑game prestige: own an apartment in every city. |

**Why `upgradeHomeLevel` variant = 2:** the mission completes when `params.homeLevel >= variant`; variant `2` = "upgrade your home to level 2", which gates on player level 15 — matching position 29. (A second entry with variant `5` could be added later in the campaign as an optional extra milestone — see §6.)

**Why `visitCityNpc` variant = 2:** variant ids are fixed in `CITY_NPC_VARIANTS` (`royalMarket`=1, `generalShop`=2, …, `materialMerchant`=8). `generalShop` exists in essentially every city, so it is the safest early, always‑completable choice.

---

## 6. Optional — seed daily‑pool city missions as milestones

These 7 already appear as daily/random missions, so adding them to the campaign is **optional** (it only changes *first‑time framing*, not reachability). If you want the city‑life arc to feel complete, the highest‑value additions are:

| Suggested final pos* | Mission | Variant | 💎 | ⭐ | Rationale |
|---:|---|---|---:|---:|---|
| ~30 | `cultivatePlants` | – | 2 | 75 | First garden harvest, right after `upgradeHomeLevel` L2. |
| ~31 | `cookRecipes` | – | 2 | 75 | First cooked recipe (same unlock as garden). |
| ~46 | `collectMaterials` | 1 (common) | 2 | 100 | Light material‑gathering intro. |
| ~58 | `depositGuildTreasury` | – | 3 | 120 | Pairs with `joinGuildHouse`. |
| ~63 | `buyGuildPetFood` | – | 2 | 100 | Guild food shop + pet (pet owned since pos 28). |

`healInBed` and `innMeal` overlap heavily with `sleepInInn` (same inn screen) — I'd **leave those two in the daily pool only** to avoid early‑game redundancy.

> \* These optional positions are *indicative*. If you decide to add them, recompute the migration array together with the mandatory set in one pass (see §7) — do **not** layer a second migration on top of a different original count.

---

## 7. Migration plan (verified)

`addCampaignMissionList(positions)` inserts a blank `0` slot per position into every player's `campaignBlob`, sorting **descending** and bumping `campaignProgression`. Positions are expressed in the **original 129‑mission** coordinate system. Consecutive new missions share the **same** original position.

**Verified migration array (original‑129 coordinates):**

```
[11, 11, 13, 13, 18, 18, 23, 27, 36, 36, 47, 51, 101, 107, 126]
```

| Final pos | Mission | Migration pos | Note |
|---:|---|---:|---|
| 11 | buyHome | 11 | |
| 12 | depositChestItem | 11 | same as above (consecutive) |
| 15 | sleepInInn | 13 | |
| 16 | visitCityNpc | 13 | same (consecutive) |
| 22 | upgradeItem | 18 | |
| 23 | replaceMission | 18 | same (consecutive) |
| 29 | upgradeHomeLevel | 23 | |
| 34 | enchantItem | 27 | |
| 44 | buyApartment | 36 | |
| 45 | collectRent | 36 | same (consecutive) |
| 57 | joinGuildHouse | 47 | |
| 62 | haveGardenTalisman | 51 | |
| 113 | cultivateAncestralTrees | 101 | |
| 120 | upgradeEpicItemLevel5 | 107 | |
| 140 | buyAllApartments | 126 | |

**Verification (project algorithm):** running `simulate_migration(129, [11,11,13,13,18,18,23,27,36,36,47,51,101,107,126])` yields the `0` positions
`[11, 12, 15, 16, 22, 23, 29, 34, 44, 45, 57, 62, 113, 120, 140]`,
which exactly equals the new‑mission positions in the regenerated `campaign.json`. ✅

**Completed‑campaign players:** set `campaignProgression = 11` (first new mission) for players with `campaignProgression = 0 AND LENGTH(campaignBlob) > 0`, so they receive the new arc.

---

## 8. Reward calibration notes

- The campaign gem curve rises from `1` (start) to `~28` (final boss mission). New entries were given gems consistent with their neighbours: 1–3 in the early/mid band, 5–6 in the late band, 12 for the end‑game `buyAllApartments`.
- Total reward delta added by the 15 missions: **+43 gems** (537 → 580) and **+1 940 XP** (23 125 → 25 065) — a ~8 % gem / ~8 % XP bump spread across the whole campaign, which is modest and front/back‑loaded sensibly.
- `moneyToWin` kept at `0` for all (consistent with 100 % of existing campaign entries).
- If you judge the early city tasks "too cheap to bother", they are intentionally light (1 💎) because they are trivial, mandatory‑path teaching steps — mirroring `commandMission` / `commandReport` at the very start.

---

## 9. Risks, edge cases & things to double‑check

1. **`upgradeHomeLevel` variant semantics.** Confirm variant `2` reads as "reach home level 2" in‑game text (`desc` uses `{{variantText}}` = the variant number). It does in `models.json`, but eyeball the rendered string.
2. **`cultivateAncestralTrees` reachability.** It needs the ancestral‑tree seed unlocked through the gardener storyline. Make sure that storyline is reachable by ~level 60 for all players, otherwise move this mission later or gate it behind a guaranteed unlock.
3. **`upgradeEpicItemLevel5` is genuinely hard** — it needs an epic+ item *and* home L5 (for level‑2 upgrades) *and* materials/gems. Position 120 (~lvl 60+) assumes a well‑geared player; if testers stall here, push it past the `reachLevel 80` anchor (pos 93→ later).
4. **`buyAllApartments` depends on how many cities define `apartmentPrice`.** If that set grows later, the mission stays correct (it checks "owns all"), but its difficulty drifts — keep it last.
5. **Single‑pass migration only.** If you also add the §6 optional missions, regenerate `campaign.json` **and** recompute the migration array in one go against the 129 baseline. Never stack two migrations computed against different counts.
6. **Translations are FR‑only** per repo policy — all 22 keys already exist in `Lang/fr/models.json`; other languages sync via Crowdin. No action needed.
7. **`down()` parity** — the draft migration's `down()` mirrors `up()` positions; verify a round‑trip on a test DB before shipping.

---

## 10. Draft implementation produced (branch `campaign-city-missions-proposal`)

To save you time on return, the **mandatory 15‑mission** proposal is already applied on that branch:

- **`Core/resources/campaign.json`** — 129 → **144** missions, purely additive diff (121 insertions, formatting matches existing 2‑space style, JSON validated).
- **`Core/src/core/database/game/migrations/063-add-city-campaign-missions.ts`** — `up()` / `down()` with the verified positions above + the completed‑player `UPDATE`. Compiles with **no TS errors**.

This is a **draft to accelerate implementation**, not a finished PR. Before shipping you should at minimum:

- run `pnpm eslint` + `pnpm test` in `Core`,
- run the migration up/down against a disposable MariaDB,
- sanity‑check the rendered FR strings and the in‑game ordering with the campaign visualizer,
- decide whether to fold in any of the §6 optional missions (and if so, recompute in one pass).

The optional §6 missions were **not** applied, to keep the migration low‑risk and reversible.
