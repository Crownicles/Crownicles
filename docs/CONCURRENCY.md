# Concurrency primer (1-pager)

> **Why this doc exists.** Two events targeting the same player can run in
> parallel (different MQTT messages, command + report, two reports racing,
> etc.). Without row-level locks, a classic _lost-update_ pattern silently
> destroys score / money / energy:
>
> ```
> A: SELECT player → score=100
> B: SELECT player → score=100
> A: score += 50; UPDATE player → score=150   (lost B's increment)
> B: score += 30; UPDATE player → score=130   (lost A's increment)
> ```
>
> Every gameplay sink (anything that writes `player`, `guild`, `home`,
> `petEntity`, `playerMissionsInfo`, `guildPet`) **must** be wrapped in a
> row-level lock that materialises the read-validate-save sequence as a
> single critical section.

---

## The 30-second tour

1. Critical section in one shot — `withLockedEntities`:

   ```ts
   import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
   import { Player } from "../database/game/models/Player";

   await withLockedEntities([Player.lockKey(player.id)], async ([lockedPlayer]) => {
       lockedPlayer.addMoney({ amount: -10, response, reason });
       await lockedPlayer.save();
   });
   ```

   Inside the callback, `lockedPlayer` is the **fresh, FOR-UPDATE-locked** row.
   The variable you captured from outside is stale — never `.save()` it.

2. Player-only shortcut — `withLockedPlayerSafe`:

   ```ts
   import { withLockedPlayerSafe } from "../utils/withLockedPlayerSafe";

   await withLockedPlayerSafe(player, "altar endCallback", async lockedPlayer => {
       // …mutate + save lockedPlayer
   });
   ```

   Same semantics as the snippet above, plus a `LockedRowNotFoundError`
   safety net (warn-and-skip) for the rare case where the player row was
   deleted between the read and the lock acquisition. The middle string
   argument is a human-readable label that surfaces in the warning log
   line if the row vanished — pass the call-site name (e.g. command +
   step) so you can grep it in production logs.

3. Multiple entities — sort-by-key is automatic:

   ```ts
   await withLockedEntities(
       [Player.lockKey(player.id), Guild.lockKey(guild.id)],
       async ([p, g]) => { /* … */ }
   );
   ```

   `withLockedEntities` sorts keys by `(tableName, id)` to prevent
   deadlocks. Never roll your own `SELECT … FOR UPDATE` chain.

---

## Naming convention: `*UnderLock`

Helpers that **assume their caller already holds the lock** must be named
`somethingUnderLock`:

```ts
private static async runUpdateUnderLock(player, missionInfo, response, info) {
    // body relies on player being a locked row
}
```

The lint rule (below) treats the `UnderLock` suffix as a guarantee. If you
break that contract, you also break the rule's assumption — rename or
re-lock instead of "just" silencing the rule.

---

## ESLint rule: `crownicles/no-unguarded-save`

A static AST rule (`eslint-custom-rules/no-unguarded-save.mjs`) flags any
`<expr>.save()` that is **not** lexically inside one of:

- a `withLockedEntities([…], async (…) => { … })` callback,
- a `withLockedPlayerSafe(…, async (…) => { … })` callback,
- a `<Model>.withLocked(…, async (…) => { … })` callback,
- a function whose name matches `/UnderLock$/`.

It is **scoped narrowly** in `Core/eslint.config.mjs` to the orchestration
files where regression risk is highest (mission update, report services,
the lock helper itself). Leaf files are protected at the call site.

### Opting out (legitimately)

The rule is syntactic — it cannot follow private helpers across method
boundaries. When you've manually verified a `.save()` is reached only from
a locked path, opt out at the line:

```ts
// eslint-disable-next-line crownicles/no-unguarded-save -- reached only from runUpdateUnderLock chain
await missionInfo.save();
```

Other accepted justifications:

- `fresh INSERT of a new XYZ row; no concurrent writer can target a row
  that does not exist yet`
- `single-field UI preference; not a resource sink (no money / score /
  energy)`
- `TODO(concurrency): not yet under withLockedEntities; tracked
  separately` — only when there is an open follow-up.

The justification is **mandatory** in code review. "It works" is not one.

---

## When to add a race integration test

Whenever you migrate a flow into a lock, add a 2-actor concurrency test
under `Core/__tests__-integration/handlers/<feature>.race.test.ts`. The
existing `playerMoneySinks.race.test.ts` and `singlePlayerSinks.race.test.ts`
are templates: spawn two `Promise.all` writers that target the same row,
assert the final state equals the **sum** of effects (not the value of
either run alone).

A flow without a race test is a flow we'll regress on the next refactor.

---

## See also

- [`docs/CONCURRENCY_PLAN.md`](CONCURRENCY_PLAN.md) — multi-PR migration plan
  and per-flow checklist.
- [`Lib/src/locks/withLockedEntities.ts`](../Lib/src/locks/withLockedEntities.ts)
  — implementation.
- [`Core/src/core/utils/withLockedPlayerSafe.ts`](../Core/src/core/utils/withLockedPlayerSafe.ts)
  — player shortcut + warn-and-skip on `LockedRowNotFoundError`.
