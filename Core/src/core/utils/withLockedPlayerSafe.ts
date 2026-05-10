import Player from "../database/game/models/Player";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Run `body` against a freshly re-fetched, row-locked instance of `player`.
 * If the row was destroyed concurrently (e.g. by `/reset`), the
 * `LockedRowNotFoundError` raised by `withLockedEntities` is downgraded to
 * a warning tagged with `context` and the body is skipped. Anything else
 * propagates.
 *
 * @param player Caller's (possibly stale) player — only `id` is read.
 * @param context Short call-site label, surfaced in the warn log line.
 * @param body Critical section. Receives the fresh, locked `Player`.
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
