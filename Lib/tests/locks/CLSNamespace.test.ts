import {
	describe, expect, it
} from "vitest";
import {
	CLS_TRANSACTION_KEY, getCrowniclesNamespace, runInChildContext
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
