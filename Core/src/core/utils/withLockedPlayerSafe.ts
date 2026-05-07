import Player from "../database/game/models/Player";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Run `body` against a freshly re-fetched, row-locked instance of `player`.
 * Any `lockedPlayer.save()` (direct or transitive) inside `body` inherits
 * the surrounding transaction through cls-hooked, so concurrent collector
 * end callbacks for the same player are serialised on the database side.
 *
 * If the player row was destroyed concurrently (e.g. by `/reset`), the
 * `LockedRowNotFoundError` raised by `withLockedEntities` is caught and
 * downgraded to a warning: the small event simply aborts, since there is
 * no row to mutate. This mirrors the no-op fallback used in
 * `MissionsController.update` and `loadAndExecuteSmallEvent`.
 *
 * @param player Caller's (possibly stale) player instance — only its `id`
 * and `keycloakId` are used to identify the row.
 * @param context Short human-readable label for the call site, used in the
 * warning log line if the row vanished concurrently.
 * @param body Critical section. Receives a fresh, locked `Player` instance.
 */
export async function withLockedPlayerSafe(
	player: Player,
	context: string,
	body: (lockedPlayer: Player) => Promise<void>
): Promise<void> {
	try {
		await withLockedEntities([Player.lockKey(player.id)], async ([lockedPlayer]) => {
			await body(lockedPlayer);
		});
	}
	catch (e) {
		if (e instanceof LockedRowNotFoundError) {
			CrowniclesLogger.warn(
				`${context}: locked row vanished for player ${player.id} — small event aborted`
			);
			return;
		}
		throw e;
	}
}
