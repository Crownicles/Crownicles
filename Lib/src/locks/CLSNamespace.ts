import {
	createNamespace, getNamespace, Namespace
} from "cls-hooked";

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
