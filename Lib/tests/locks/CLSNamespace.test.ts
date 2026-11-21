import {
	afterEach, describe, expect, it, vi
} from "vitest";
import type { Namespace } from "cls-hooked";
import {
	_resetUseCLSForTests,
	assertUnderLock,
	CLS_TRANSACTION_KEY,
	CROWNICLES_CLS_NAMESPACE,
	getCrowniclesNamespace,
	getCurrentTransaction,
	MissingLockContextError,
	runInChildContext,
	useCLSOnSequelize
} from "../../src/locks/CLSNamespace";

const PROBE_KEY = "runInChildContextProbe";

type Gate = {
	opened: Promise<void>;
	open: () => void;
};

function createGate(): Gate {
	let open!: () => void;
	const opened = new Promise<void>(resolve => {
		open = resolve;
	});
	return {
		opened, open
	};
}

function readProbeFromImmediate(): Promise<unknown> {
	return new Promise(resolve => setImmediate(() => resolve(getCrowniclesNamespace().get(PROBE_KEY))));
}

describe("runInChildContext", () => {
	it("gives the body the child values and the values of the current context", async () => {
		const namespace = getCrowniclesNamespace();
		const transaction = { id: "outer" };
		let seen: { probe: unknown; transaction: unknown } | undefined;

		await new Promise<void>((resolve, reject) => {
			namespace.run(() => {
				namespace.set(CLS_TRANSACTION_KEY, transaction);
				runInChildContext({ [PROBE_KEY]: "child" }, async () => {
					await Promise.resolve();
					seen = {
						probe: namespace.get(PROBE_KEY),
						transaction: namespace.get(CLS_TRANSACTION_KEY)
					};
				}).then(resolve, reject);
			});
		});

		expect(seen).toEqual({
			probe: "child",
			transaction
		});
	});

	it("does not leak the child context to unrelated callbacks while the body is pending", async () => {
		const namespace = getCrowniclesNamespace();
		const activeContextBefore = namespace.active;
		const bodyStarted = createGate();
		const bodyReleased = createGate();

		const running = runInChildContext({ [PROBE_KEY]: "child" }, async () => {
			bodyStarted.open();
			await bodyReleased.opened;
			return namespace.get(PROBE_KEY);
		});
		const activeContextAfterCall = namespace.active;
		await bodyStarted.opened;
		const seenByUnrelatedCallback = await readProbeFromImmediate();
		bodyReleased.open();

		expect(await running).toBe("child");
		expect(activeContextAfterCall).toBe(activeContextBefore);
		expect(seenByUnrelatedCallback).toBeUndefined();
		expect(namespace.get(PROBE_KEY)).toBeUndefined();
	});

	it("rejects with the error of the body", async () => {
		const error = new Error("body failed");

		await expect(runInChildContext({ [PROBE_KEY]: "child" }, () => Promise.reject(error))).rejects.toBe(error);
		expect(getCrowniclesNamespace().get(PROBE_KEY)).toBeUndefined();
	});
});

function runWithTransaction<T>(transaction: unknown, body: () => T): T {
	const namespace = getCrowniclesNamespace();
	return namespace.runAndReturn(() => {
		namespace.set(CLS_TRANSACTION_KEY, transaction);
		return body();
	});
}

describe("getCrowniclesNamespace", () => {
	it("returns the namespace registered in cls-hooked under the Crownicles name", () => {
		const namespace = getCrowniclesNamespace();

		expect(namespace.name).toBe(CROWNICLES_CLS_NAMESPACE);
		expect(getCrowniclesNamespace()).toBe(namespace);
	});
});

describe("useCLSOnSequelize", () => {
	afterEach(() => {
		_resetUseCLSForTests();
	});

	function makeSequelizeCtor(): { useCLS: ReturnType<typeof vi.fn<(ns: Namespace) => unknown>> } {
		return { useCLS: vi.fn<(ns: Namespace) => unknown>() };
	}

	it("wires the shared namespace into the constructor", () => {
		const ctor = makeSequelizeCtor();

		useCLSOnSequelize(ctor);

		expect(ctor.useCLS).toHaveBeenCalledTimes(1);
		expect(ctor.useCLS).toHaveBeenCalledWith(getCrowniclesNamespace());
	});

	it("wires each constructor copy only once", () => {
		const first = makeSequelizeCtor();
		const second = makeSequelizeCtor();

		useCLSOnSequelize(first);
		useCLSOnSequelize(first);
		useCLSOnSequelize(second);

		expect(first.useCLS).toHaveBeenCalledTimes(1);
		expect(second.useCLS).toHaveBeenCalledTimes(1);
	});

	it("wires a constructor again after the test reset", () => {
		const ctor = makeSequelizeCtor();

		useCLSOnSequelize(ctor);
		_resetUseCLSForTests();
		useCLSOnSequelize(ctor);

		expect(ctor.useCLS).toHaveBeenCalledTimes(2);
	});
});

describe("assertUnderLock", () => {
	it("throws a MissingLockContextError naming the helper outside any transaction", () => {
		let error: unknown;
		try {
			assertUnderLock("applyRewardUnderLock");
		}
		catch (e) {
			error = e;
		}

		expect(error).toBeInstanceOf(MissingLockContextError);
		expect(error).toMatchObject({
			name: "MissingLockContextError",
			message: "applyRewardUnderLock: called outside any withLockedEntities / withLockedPlayerSafe / <Model>.withLocked critical section. "
				+ "Helpers suffixed with 'UnderLock' assume their caller already holds a row-level lock; wrap the call site accordingly."
		});
	});

	it("passes when a transaction is bound to the current context", () => {
		expect(() => runWithTransaction({ id: "tx" }, () => assertUnderLock("applyRewardUnderLock"))).not.toThrow();
	});
});

describe("getCurrentTransaction", () => {
	it("returns the transaction of the current context, and nothing outside of it", () => {
		const transaction = { id: "tx" };

		expect(runWithTransaction(transaction, getCurrentTransaction)).toBe(transaction);
		expect(getCurrentTransaction()).toBeUndefined();
	});
});
