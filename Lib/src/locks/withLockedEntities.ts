import {
	Model, ModelStatic, Transaction
} from "sequelize";

/**
 * A handle on a row that the caller wants to lock with
 * `SELECT … FOR UPDATE` for the duration of a {@link withLockedEntities}
 * critical section.
 *
 * Build instances of this through the `lockKey()` static of any model
 * that participates in the lock protocol — never construct them by hand
 * at call sites, so the type parameter is always inferred correctly.
 */
export interface LockKey<M extends Model = Model> {
	readonly model: ModelStatic<M>;
	readonly id: number;
}

/**
 * Maps a tuple of `LockKey` to the matching tuple of model instances.
 * `withLockedEntities` returns instances in the caller's *original*
 * order, regardless of the canonical lock-acquisition order.
 */
export type ResolveEntities<K extends readonly LockKey<Model>[]> = {
	[I in keyof K]: K[I] extends LockKey<infer M> ? M : never;
};

const lockCacheKey = (k: LockKey<Model>): string => `${k.model.tableName}#${k.id}`;

const compareKeys = (a: LockKey<Model>, b: LockKey<Model>): number => {
	const tableCmp = a.model.tableName.localeCompare(b.model.tableName);
	if (tableCmp !== 0) {
		return tableCmp;
	}
	return a.id - b.id;
};

/**
 * Opens a Sequelize transaction, acquires `SELECT … FOR UPDATE` row locks
 * on every requested entity in canonical order — `(tableName, id)` —
 * then re-fetches each row inside the transaction and passes the fresh
 * instances to `fn`.
 *
 * **Why canonical order?** Sequential acquisition under a stable global
 * order is the textbook deadlock-prevention strategy for fixed-size lock
 * sets: two transactions racing for the same set of rows will always
 * acquire the first contended row in the same direction, so one will
 * simply wait for the other instead of forming a cycle.
 *
 * **Why a re-fetch?** Any value that the caller read *before*
 * `withLockedEntities` might be stale by the time the lock is taken.
 * Re-fetching inside the critical section is the only way to guarantee
 * that subsequent writes are based on the committed state.
 *
 * **CLS propagation.** The transaction is registered in the shared
 * `crownicles-tx` namespace (see `CLSNamespace.ts`), so any
 * `model.save()` / `model.update()` / `findByPk(...)` executed inside
 * `fn` (directly or transitively) automatically uses this transaction
 * without the caller having to thread it manually.
 *
 * **Lifecycle.** If `fn` resolves, the transaction is committed and its
 * resolved value is returned. If `fn` throws (or any locked row is not
 * found), the transaction is rolled back and the error propagates.
 *
 * **Duplicates.** The same `(model, id)` may appear several times in
 * `keys`; the row is locked exactly once and the same instance is
 * surfaced at every matching position of the returned tuple.
 *
 * @param keys Lock keys describing the rows to lock. Must be non-empty
 * and all attached to the same Sequelize instance.
 * @param fn Critical section. Receives a tuple of fresh, locked model
 * instances in the same order as `keys`.
 */
export async function withLockedEntities<
	K extends readonly LockKey<Model>[],
	R
>(
	keys: K,
	fn: (entities: ResolveEntities<K>) => Promise<R>
): Promise<R> {
	if (keys.length === 0) {
		throw new Error("withLockedEntities: keys must be non-empty");
	}

	const sequelize = keys[0].model.sequelize;
	if (!sequelize) {
		throw new Error(`withLockedEntities: model ${keys[0].model.name} is not bound to a Sequelize instance`);
	}

	/*
	 * Sanity check: all keys must share the same Sequelize instance, otherwise
	 * we cannot lock them in a single transaction.
	 */
	for (const k of keys) {
		if (k.model.sequelize !== sequelize) {
			throw new Error(
				`withLockedEntities: model ${k.model.name} is bound to a different Sequelize instance than ${keys[0].model.name}`
			);
		}
	}

	const sorted = [...keys].sort(compareKeys);

	return await sequelize.transaction(async (t: Transaction) => {
		const lockedByKey = new Map<string, Model>();

		for (const key of sorted) {
			const ck = lockCacheKey(key);
			if (lockedByKey.has(ck)) {
				continue;
			}
			const instance = await key.model.findByPk(key.id, {
				lock: t.LOCK.UPDATE,
				transaction: t
			});
			if (!instance) {
				throw new Error(`withLockedEntities: row not found for ${ck}`);
			}
			lockedByKey.set(ck, instance);
		}

		const entities = keys.map(k => lockedByKey.get(lockCacheKey(k))!);
		return fn(entities as unknown as ResolveEntities<K>);
	});
}
