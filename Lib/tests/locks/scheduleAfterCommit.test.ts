import {
	describe, expect, it, vi
} from "vitest";
import {
	CLS_TRANSACTION_KEY, getCrowniclesNamespace
} from "../../src/locks/CLSNamespace";
import { scheduleAfterCommit } from "../../src/locks/scheduleAfterCommit";

describe("scheduleAfterCommit", () => {
	it("runs immediately outside a transaction", async () => {
		const task = vi.fn().mockResolvedValue(undefined);

		scheduleAfterCommit(task, vi.fn());
		await Promise.resolve();

		expect(task).toHaveBeenCalledOnce();
	});

	it("waits for commit and clears the transaction context", async () => {
		const namespace = getCrowniclesNamespace();
		let afterCommit: (() => void) | undefined;
		const transaction = {
			afterCommit: vi.fn(callback => {
				afterCommit = callback;
			})
		};
		const observedTransaction = vi.fn();

		await namespace.runPromise(async () => {
			namespace.set(CLS_TRANSACTION_KEY, transaction);
			scheduleAfterCommit(async () => {
				observedTransaction(namespace.get(CLS_TRANSACTION_KEY));
			}, vi.fn());

			expect(observedTransaction).not.toHaveBeenCalled();
			afterCommit?.();
			await Promise.resolve();
		});

		expect(observedTransaction).toHaveBeenCalledWith(null);
	});

	it("does not run when the transaction never commits", async () => {
		const namespace = getCrowniclesNamespace();
		const task = vi.fn().mockResolvedValue(undefined);
		const transaction = { afterCommit: vi.fn() };

		await namespace.runPromise(async () => {
			namespace.set(CLS_TRANSACTION_KEY, transaction);
			scheduleAfterCommit(task, vi.fn());
		});

		expect(task).not.toHaveBeenCalled();
	});

	it("uses an explicit transaction outside CLS", async () => {
		let afterCommit: (() => void) | undefined;
		const transaction = {
			afterCommit: vi.fn(callback => {
				afterCommit = callback;
			})
		};
		const task = vi.fn().mockResolvedValue(undefined);

		scheduleAfterCommit(task, vi.fn(), transaction as never);
		expect(task).not.toHaveBeenCalled();

		afterCommit?.();
		await Promise.resolve();
		expect(task).toHaveBeenCalledOnce();
	});

	it("reports task errors without rejecting the transaction callback", async () => {
		const error = new Error("notification failed");
		const onError = vi.fn();

		scheduleAfterCommit(() => Promise.reject(error), onError);
		await Promise.resolve();
		await Promise.resolve();

		expect(onError).toHaveBeenCalledWith(error);
	});
});
