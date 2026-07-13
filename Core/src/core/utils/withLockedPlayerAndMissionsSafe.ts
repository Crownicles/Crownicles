import { ForeignKeyConstraintError } from "sequelize";
import Player from "../database/game/models/Player";
import { LockedRowNotFoundError } from "../../../../Lib/src/locks/withLockedEntities";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";
import { withLockedPlayerAndMissions } from "./withLockedPlayerAndMissions";

/**
 * Mission-aware counterpart of {@link withLockedPlayerSafe}: lock the player's
 * `PlayerMissionsInfo` + `Player` rows in canonical order and warn-and-skip if
 * the player vanished concurrently.
 *
 * `ForeignKeyConstraintError` covers the narrow race where the player is deleted
 * while `PlayerMissionsInfos.getOfPlayer` is prewarming the missions row, before
 * `withLockedEntities` can surface a {@link LockedRowNotFoundError}.
 *
 * @param player Caller's (possibly stale) player — only `id` is read.
 * @param context Short call-site label, surfaced in the warn log line.
 * @param body Critical section. Receives the fresh, locked `Player`.
 */
export async function withLockedPlayerAndMissionsSafe(
	player: Player,
	context: string,
	body: (lockedPlayer: Player) => Promise<void>
): Promise<void> {
	try {
		await withLockedPlayerAndMissions(player.id, body);
	}
	catch (error) {
		if (error instanceof LockedRowNotFoundError || error instanceof ForeignKeyConstraintError) {
			CrowniclesLogger.warn(`${context}: player ${player.id} vanished while acquiring player + missions locks — small event aborted`);
			return;
		}
		throw error;
	}
}
