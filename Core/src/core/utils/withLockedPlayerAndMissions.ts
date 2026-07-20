import Player from "../database/game/models/Player";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";
import { DailyMissions } from "../database/game/models/DailyMission";

/**
 * Lock a player's `Player` **and** `PlayerMissionsInfo` rows (in canonical order) and run
 * `body` against the freshly re-fetched, locked `Player`.
 *
 * Use this instead of `Player.withLocked(...)` whenever the critical section mutates a player
 * value (`addMoney` / `spendMoney` / `addExperience` / `addHealth` / `addScore` / `addTokens`
 * / `setGloryPoints` / `addRage` / level-up): those all go through `MissionsController.update`,
 * which locks `player_missions_info` + `players`. Locking a player-only row first and then
 * letting the nested mission update acquire `player_missions_info` inverts the canonical lock
 * order (`players -> player_missions_info`) and can deadlock against a concurrent standalone
 * mission update on the same player. Acquiring both rows up-front keeps the order canonical.
 * The daily mission is resolved before either row is locked because its rollover resets every
 * `player_missions_info` row. Running that reset under a per-player lock can deadlock with another
 * player's concurrent rollover.
 *
 * @param playerId The player whose rows to lock.
 * @param body Critical section. Receives the fresh, locked `Player`.
 */
export async function withLockedPlayerAndMissions<T>(playerId: number, body: (lockedPlayer: Player) => Promise<T>): Promise<T> {
	await DailyMissions.getOrGenerate();
	await PlayerMissionsInfos.getOfPlayer(playerId);
	return await withLockedEntities(
		[Player.lockKey(playerId), PlayerMissionsInfo.lockKey(playerId)] as const,
		([lockedPlayer]) => body(lockedPlayer)
	);
}
