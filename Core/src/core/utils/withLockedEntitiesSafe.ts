import { Model } from "sequelize";
import {
	LockedRowNotFoundError, LockKey, ResolveEntities, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import { CrowniclesLogger } from "../../../../Lib/src/logs/CrowniclesLogger";

/**
 * Same contract as {@link withLockedEntities} but downgrades a
 * {@link LockedRowNotFoundError} to a warn log and returns `false`,
 * so call sites can skip user-facing side effects (packets, money
 * spending, response building) when one of the locked rows vanished
 * concurrently. Any other error propagates unchanged.
 *
 * Returns `true` when the body ran to completion, `false` when a row
 * was missing.
 *
 * @param keys Lock keys describing the rows to lock.
 * @param context Short call-site label, surfaced in the warn log line.
 * @param body Critical section. Receives the fresh, locked entities.
 */
export async function withLockedEntitiesSafe<K extends readonly LockKey<Model>[]>(
	keys: K,
	context: string,
	body: (entities: ResolveEntities<K>) => Promise<void>
): Promise<boolean> {
	try {
		await withLockedEntities(keys, async entities => {
			await body(entities);
		});
		return true;
	}
	catch (e) {
		if (e instanceof LockedRowNotFoundError) {
			CrowniclesLogger.warn(
				`${context}: locked row vanished (${e.tableName}#${e.id}) — skipping`
			);
			return false;
		}
		throw e;
	}
}
