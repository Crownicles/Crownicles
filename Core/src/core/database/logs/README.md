# Logs database — city economy logging (issue #3806)

This module stores **append-only** logs of every city-scoped economic action
(inns, blacksmith, enchanter, shop, notary, home/apartments, garden, cooking,
guild domain visits, city visits funnel). Game logic lives in `core/report/*`
and `commands/*`; this folder is purely a sink.

## Invariants

1. **One `logCity*` call per successful action.** Each gameplay handler under
   `core/report/ReportCity*Service.ts` (or `core/utils/TannerShopItems.ts` for
   the classical shop) fires the matching `crowniclesInstance?.logsDatabase.logXxx({...}).then();`
   **after** the `Player.withLocked` (or `withLockedEntities`) block that
   successfully persisted the money/energy/health change. Logging is
   fire-and-forget — it must never block, await, or rollback the gameplay
   transaction.

2. **`cityId` is always resolved via `Player.getCurrentCityId()`** (see
   `Core/src/core/database/game/models/Player.ts`). Do not re-implement the
   `getDestinationId() → CityDataController.getCityByMapLinkId(...).id`
   ternary in service files — call the helper and coerce to `undefined` only
   if the consumer's signature demands it.

3. **Keycloak id → log player row** goes through `findOrCreateLogsPlayer`
   (see `LogsPlayerResolver.ts`). Empty string returns `null`; loggers must
   short-circuit on `null` rather than crashing.

4. **Append-only models** call `Model.removeAttribute("id")` so Sequelize
   issues plain `INSERT` statements without an auto-increment primary key.
   The `city_visits` table is the one exception that keeps a primary key
   because it is updated at the end of the visit (exit reason + menu mask
   are not known at INSERT time).

5. **Migrations are sequentially numbered** under `migrations/` (last:
   `030-city-visits-logging.ts`). Every new migration **and** every new model
   file starts with `/* eslint-disable new-cap */` to silence the Sequelize
   data-type imports.

## Adding a new city-scoped log table

1. Add a new migration `migrations/0NN-<feature>-logging.ts` mirroring the
   shape of `030-city-visits-logging.ts` (FK to `players.id` on
   `ON DELETE CASCADE`, `cityId STRING(32)`, indexes on `(playerId)`,
   `(cityId)`, `(<timeColumn>)`).
2. Add the matching `models/LogsXxx.ts` (mirror of migration, with
   `removeAttribute("id")` if append-only).
3. Expose params interface + method on the corresponding logger class
   (`LogsCityLogger`, `LogsBlessingLogger`, …) and add a one-line delegate
   on `LogsDatabase`.
4. Wire the call from the gameplay handler **after** the locked save.
5. Add a GDPR exporter entry in `commands/admin/gdpr/exporters/LogsCityExporter.ts`
   and the corresponding line in
   `__tests__/core/commands/gdpr/GDPRExportCoverage.test.ts`.

## Reading the data

These tables are analytics-only. No gameplay path reads them. Query them
directly from Grafana on the `logs` MariaDB via the `mcp_sql-reader_query_logs_db`
tool or a Grafana panel. Common joins:

- `LEFT JOIN logs_players USING (playerId)` to re-attach `keycloakId`.
- Aggregate per `cityId` to compare visited cities to those engaged with
  (cross-reference `city_visits.menusOpenedMask` bits).

## Backward compatibility

The existing per-resource tables (`players_money`, `players_energy`,
`players_health`, `players_gems`, …) continue to be populated in parallel.
Rows logged before this issue have no `cityId`; treat the column as nullable
when joining historical data.
