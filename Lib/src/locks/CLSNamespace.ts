import {
	createNamespace, getNamespace, Namespace
} from "cls-hooked";
import type {
	Sequelize, Transaction
} from "sequelize";

/**
 * Minimal shape of `Sequelize` we depend on here. Typed as a structural
 * interface so callers can pass any copy of the constructor — pnpm may
 * resolve several physical instances of `sequelize` across packages
 * (different `mariadb` peer-dep selectors), and the CLS namespace must
 * be registered on each one that actually instantiates connections.
 *
 * The return value of `useCLS` is unused and intentionally typed as
 * `unknown`; this keeps us free of any value-position reference to the
 * `Sequelize` constructor (which would force a runtime import).
 */
type SequelizeCtor = {
	useCLS(ns: Namespace): unknown;
};

/**
 * Key under which Sequelize stores the currently-active transaction in
 * the CLS namespace (see Sequelize v6 `lib/sequelize.js#useCLS`). All
 * Crownicles code that reads or writes the active transaction MUST go
 * through this constant rather than hardcoding the literal string, so
 * that the coupling with the Sequelize CLS contract lives in exactly
 * one place.
 */
export const CLS_TRANSACTION_KEY = "transaction" as const;

/**
 * Name of the shared CLS (Continuation-Local Storage) namespace used by
 * {@link withLockedEntities} to thread the current Sequelize transaction
 * through nested asynchronous calls.
 *
 * Any `model.save()`, `model.update()`, etc. executed inside a
 * `withLockedEntities` callback automatically picks up the active
 * transaction from this namespace — there is no need to plumb a
 * `transaction` option through every call site.
 *
 * The string is exported as a constant so tests can resolve the same
 * namespace in setup helpers.
 */
export const CROWNICLES_CLS_NAMESPACE = "crownicles-tx";

let namespaceSingleton: Namespace | null = null;
let wiredCtors = new WeakSet<SequelizeCtor>();

/**
 * Returns (creating it on first call) the shared `cls-hooked` namespace.
 *
 * Safe to call multiple times from anywhere — the underlying namespace is
 * registered globally inside `cls-hooked`, so callers that import this
 * module from different bundles still share the same context store.
 */
export function getCrowniclesNamespace(): Namespace {
	if (namespaceSingleton) {
		return namespaceSingleton;
	}
	namespaceSingleton = getNamespace(CROWNICLES_CLS_NAMESPACE)
		?? createNamespace(CROWNICLES_CLS_NAMESPACE);
	return namespaceSingleton;
}

/**
 * Wires the shared namespace into the supplied Sequelize constructor so
 * that every model operation (save / update / destroy / find / …)
 * executed inside `namespace.run(...)` (or any `withLockedEntities`
 * callback) uses the current transaction by default.
 *
 * Must be called **once per Sequelize constructor copy, before any
 * `new Sequelize(...)` instantiation against that copy** (Sequelize v6
 * freezes the CLS namespace at construction time of each connection).
 * Calling it more than once with the same constructor is a no-op, so
 * wiring this from the shared `Database` bootstrap is safe even when
 * several services boot in the same process during integration tests.
 *
 * @param sequelizeCtor The `Sequelize` class. Pass it explicitly from the
 * call site so the wiring lands on the same physical module the caller
 * uses to create connections — pnpm may resolve more than one copy.
 */
export function useCLSOnSequelize(sequelizeCtor: SequelizeCtor): void {
	if (wiredCtors.has(sequelizeCtor)) {
		return;
	}

	// Force-register the namespace before Sequelize captures it.
	getCrowniclesNamespace();

	/*
	 * Sequelize.useCLS is a static method on the constructor — see
	 * https://sequelize.org/docs/v6/other-topics/transactions/#automatically-pass-transactions-to-all-queries
	 */
	sequelizeCtor.useCLS(getCrowniclesNamespace());
	wiredCtors.add(sequelizeCtor);
}

/**
 * Test-only escape hatch. Resets the internal "already wired" tracker so
 * a test can re-arm CLS against a fresh Sequelize import. **Never call
 * this from production code.**
 */
export function _resetUseCLSForTests(): void {
	wiredCtors = new WeakSet<SequelizeCtor>();
}

/**
 * Thrown by {@link assertUnderLock} when a `*UnderLock` helper is invoked
 * without an active Sequelize transaction in the CLS context — meaning
 * the caller forgot to wrap the call site in `withLockedEntities` /
 * `withLockedPlayerSafe` / `<Model>.withLocked`. Treat it as a
 * programming error: the read-validate-save sequence the helper relies
 * on would not be atomic.
 */
export class MissingLockContextError extends Error {
	constructor(helperName: string) {
		super(
			`${helperName}: called outside any withLockedEntities / withLockedPlayerSafe / <Model>.withLocked critical section. `
			+ "Helpers suffixed with 'UnderLock' assume their caller already holds a row-level lock; wrap the call site accordingly."
		);
		this.name = "MissingLockContextError";
	}
}

/**
 * Runtime guard for `*UnderLock` helpers. Throws
 * {@link MissingLockContextError} if the current async context has no
 * active transaction in the Crownicles CLS namespace (i.e. the caller
 * is not inside a `withLockedEntities` / `withLockedPlayerSafe` /
 * `<Model>.withLocked` callback).
 *
 * The lookup matches the key Sequelize stores its CLS-bound transaction
 * under ({@link CLS_TRANSACTION_KEY}, see Sequelize v6's
 * `lib/sequelize.js#useCLS`). This is the same value `model.save()`
 * picks up automatically inside a guarded section, so checking its
 * presence is a reliable proxy for "I am being called under a lock".
 *
 * @param helperName Name of the helper being asserted, used in the
 * thrown error message to make the call site obvious in stack traces.
 */
export function assertUnderLock(helperName: string): void {
	if (!getCurrentTransaction()) {
		throw new MissingLockContextError(helperName);
	}
}

/**
 * Returns the Sequelize transaction currently bound to the shared CLS
 * namespace, or `undefined` when the caller is not inside any
 * `withLockedEntities` / `withLockedPlayerSafe` / `<Model>.withLocked`
 * critical section.
 *
 * This is the single supported way to read the active transaction from
 * Crownicles code. Centralising the CLS lookup keeps the coupling with
 * Sequelize's internal CLS key in {@link CLS_TRANSACTION_KEY} alone.
 */
export function getCurrentTransaction(): Transaction | undefined {
	return getCrowniclesNamespace().get(CLS_TRANSACTION_KEY) as Transaction | undefined;
}

/**
 * Returns the {@link Sequelize} instance a given transaction belongs to.
 *
 * Sequelize v6 attaches the owning Sequelize instance to every
 * `Transaction` as the (undeclared but stable) `sequelize` own property
 * — that's how Sequelize itself routes queries back to the right
 * connection pool. This helper exposes the property in a typed way so
 * callers don't have to repeat the `as unknown as { sequelize?: Sequelize }`
 * cast (and don't accidentally rely on a different undocumented field).
 *
 * Returns `undefined` if the runtime Transaction unexpectedly lacks the
 * `sequelize` field (defensive: should not happen with sequelize@6).
 */
export function getTransactionSequelize(transaction: Transaction): Sequelize | undefined {
	return (transaction as unknown as { sequelize?: Sequelize }).sequelize;
}
