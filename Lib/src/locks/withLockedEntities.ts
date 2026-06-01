import {
	Model, ModelStatic, Transaction
} from "sequelize";
import {
	getCurrentTransaction, getTransactionSequelize
} from "./CLSNamespace";

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
 * Thrown by {@link withLockedEntities} when one of the requested rows
 * cannot be loaded inside the transaction (typically because a
 * concurrent transaction already destroyed it). Callers can catch
 * this specific error to convert "the row I was about to mutate is
 * gone" into a graceful "situation changed" response instead of an
 * internal-server error.
 */
export class LockedRowNotFoundError extends Error {
	readonly tableName: string;

	readonly id: number;

	constructor(tableName: string, id: number) {
		super(`withLockedEntities: row not found for ${tableName}#${id}`);
		this.name = "LockedRowNotFoundError";
		this.tableName = tableName;
		this.id = id;
	}
}

/**
 * Maps a tuple of `LockKey` to the matching tuple of model instances.
 * `withLockedEntities` returns instances in the caller's *original*
 * order, regardless of the canonical lock-acquisition order.
 */
export type ResolveEntities<K extends readonly LockKey<Model>[]> = {
	[I in keyof K]: K[I] extends LockKey<infer M> ? M : never;
};

const lockCacheKey = (key: LockKey<Model>): string => `${key.model.tableName}#${key.id}`;

const compareKeys = (left: LockKey<Model>, right: LockKey<Model>): number => {
	const tableCmp = left.model.tableName.localeCompare(right.model.tableName);
	if (tableCmp !== 0) {
		return tableCmp;
	}
	return left.id - right.id;
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
	for (const key of keys) {
		if (key.model.sequelize !== sequelize) {
			throw new Error(
				`withLockedEntities: model ${key.model.name} is bound to a different Sequelize instance than ${keys[0].model.name}`
			);
		}
	}

	const sorted = [...keys].sort(compareKeys);

	/*
	 * Reentrancy: if the caller is already running inside an active
	 * `withLockedEntities` (the CLS namespace holds a transaction bound
	 * to the same Sequelize instance), reuse that transaction instead of
	 * opening a new one.
	 *
	 * Why this matters: `sequelize.transaction(autoCallback)` ALWAYS
	 * grabs a fresh connection from the pool — it does NOT auto-promote
	 * to a savepoint when an outer transaction is already in CLS. So a
	 * nested call would run on a second physical connection, and any
	 * row already `FOR UPDATE`-locked by the outer transaction would
	 * make the inner one wait forever (50 s `innodb_lock_wait_timeout`,
	 * surfaced as `ER_LOCK_WAIT_TIMEOUT`). Since the outer is parked
	 * awaiting its own callback to return, the inner times out alone:
	 * MariaDB sees no cycle, so it cannot trigger deadlock detection.
	 *
	 * Reusing the existing transaction is safe: `SELECT ... FOR UPDATE`
	 * on a row already locked by the same transaction is a no-op, and
	 * any additional rows are simply locked alongside the existing
	 * lockset inside that single transaction.
	 */
	const existing = getCurrentTransaction();
	if (existing) {
		if (getTransactionSequelize(existing) === sequelize) {
			return await acquireAndRun(sorted, keys, existing, fn);
		}

		/*
		 * Reentrancy on a *different* Sequelize instance is not supported.
		 *
		 * Sequelize v6's `useCLS` stores the active transaction in a single
		 * shared CLS slot (`CLS_TRANSACTION_KEY`). If we opened a new
		 * transaction on `sequelize` here while another sequelize's
		 * transaction is already in CLS, the inner `sequelize.transaction(...)`
		 * would overwrite that slot for the duration of `fn`. Any parallel
		 * await branch inside `fn` that hits the *outer* sequelize via CLS
		 * would then route its query through the inner transaction's
		 * connection — the exact class of bug `LogsDatabase.installForeign
		 * TransactionGuard` was added to defend against on the logs side.
		 *
		 * Locks across DB instances are not a use case Crownicles needs, so
		 * we refuse the call loudly instead of silently corrupting CLS.
		 */
		throw new Error(
			`withLockedEntities: nested call on a different Sequelize instance is not supported (outer=${getTransactionSequelize(existing).config?.database ?? "?"}, inner=${sequelize.config?.database ?? "?"}).`
		);
	}

	return await sequelize.transaction(transaction => acquireAndRun(sorted, keys, transaction, fn));
}

async function acquireAndRun<
	K extends readonly LockKey<Model>[],
	R
>(
	sorted: LockKey<Model>[],
	keys: K,
	transaction: Transaction,
	fn: (entities: ResolveEntities<K>) => Promise<R>
): Promise<R> {
	const lockedByKey = new Map<string, Model>();

	for (const key of sorted) {
		const cacheKey = lockCacheKey(key);
		if (lockedByKey.has(cacheKey)) {
			continue;
		}
		const instance = await key.model.findByPk(key.id, {
			lock: transaction.LOCK.UPDATE,
			transaction
		});
		if (!instance) {
			throw new LockedRowNotFoundError(key.model.tableName, key.id);
		}
		lockedByKey.set(cacheKey, instance);
	}

	const entities = keys.map(key => lockedByKey.get(lockCacheKey(key))!);

	/*
	 * The `as unknown as ResolveEntities<K>` cast is unavoidable here:
	 * `keys.map(...)` produces a flat `Model[]`, but the public signature of
	 * `withLockedEntities` promises a heterogeneous tuple typed by the mapped
	 * type `ResolveEntities<K>` (one position per element of the readonly
	 * tuple `K`). TypeScript cannot express that `Array#map` over a tuple
	 * preserves the per-index mapping without variadic tuple machinery that
	 * doesn't apply to `Model.findByPk` return types. The invariant is
	 * guaranteed at runtime by the loop above: each `key` resolves to its
	 * own locked instance in declaration order.
	 */
	return fn(entities as unknown as ResolveEntities<K>);
}
