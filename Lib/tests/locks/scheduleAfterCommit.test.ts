import {
	describe, expect, it, vi
} from "vitest";
import {
	CLS_TRANSACTION_KEY, getCrowniclesNamespace
} from "../../src/locks/CLSNamespace";
import {
	bufferUntilCommit, runAfterCommit, scheduleAfterCommit
} from "../../src/locks/scheduleAfterCommit";

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

describe("runAfterCommit", () => {
	it("runs and awaits the task immediately outside a transaction", async () => {
		const namespace = getCrowniclesNamespace();
		const observedTransaction = vi.fn();

		await runAfterCommit(async () => {
			await Promise.resolve();
			observedTransaction(namespace.get(CLS_TRANSACTION_KEY));
		});

		expect(observedTransaction).toHaveBeenCalledWith(null);
	});

	it("defers the task to a commit hook that awaits it outside the transaction", async () => {
		const namespace = getCrowniclesNamespace();
		let afterCommit: (() => Promise<void>) | undefined;
		const transaction = {
			afterCommit: vi.fn(callback => {
				afterCommit = callback;
			})
		};
		const observedTransaction = vi.fn();

		await namespace.runPromise(async () => {
			namespace.set(CLS_TRANSACTION_KEY, transaction);
			await runAfterCommit(async () => {
				await Promise.resolve();
				observedTransaction(namespace.get(CLS_TRANSACTION_KEY));
			});
			expect(observedTransaction).not.toHaveBeenCalled();

			await afterCommit?.();
			expect(observedTransaction).toHaveBeenCalledWith(null);
		});
	});

	it("does not run when the transaction never commits", async () => {
		const namespace = getCrowniclesNamespace();
		const task = vi.fn().mockResolvedValue(undefined);
		const transaction = { afterCommit: vi.fn() };

		await namespace.runPromise(async () => {
			namespace.set(CLS_TRANSACTION_KEY, transaction);
			await runAfterCommit(task);
		});

		expect(task).not.toHaveBeenCalled();
	});

	it("propagates task errors to the commit hook", async () => {
		const namespace = getCrowniclesNamespace();
		const error = new Error("guild reward failed");
		let afterCommit: (() => Promise<void>) | undefined;
		const transaction = {
			afterCommit: vi.fn(callback => {
				afterCommit = callback;
			})
		};

		await namespace.runPromise(async () => {
			namespace.set(CLS_TRANSACTION_KEY, transaction);
			await runAfterCommit(() => Promise.reject(error));
		});

		await expect(afterCommit?.()).rejects.toBe(error);
	});
});

describe("bufferUntilCommit", () => {
	type FakeTransaction = {
		afterCommit: (hook: () => void) => void;
		commit: () => void;
	};

	function createTransaction(): FakeTransaction {
		const hooks: (() => void)[] = [];
		return {
			afterCommit: hook => {
				hooks.push(hook);
			},
			commit: (): void => {
				for (const hook of hooks) {
					hook();
				}
			}
		};
	}

	async function inTransaction(transaction: FakeTransaction, body: () => Promise<void>): Promise<void> {
		const namespace = getCrowniclesNamespace();
		await namespace.runPromise(async () => {
			namespace.set(CLS_TRANSACTION_KEY, transaction);
			await body();
		});
	}

	it("writes to the target directly outside a transaction", async () => {
		const target = ["before"];

		await bufferUntilCommit(target, buffer => {
			buffer.push("granted");
			return Promise.resolve();
		});

		expect(target).toEqual(["before", "granted"]);
	});

	it("inserts the items on commit at their position, the nested buffers included", async () => {
		const transaction = createTransaction();
		const target = ["before"];

		await inTransaction(transaction, async () => {
			await bufferUntilCommit(target, async buffer => {
				buffer.push("first reward");
				await bufferUntilCommit(buffer, nestedBuffer => {
					nestedBuffer.push("nested reward");
					return Promise.resolve();
				});
				buffer.push("first reward end");
			});
			target.push("between");
			await bufferUntilCommit(target, buffer => {
				buffer.push("second reward");
				return Promise.resolve();
			});
			target.push("after");
		});
		expect(target).toEqual(["before", "between", "after"]);

		transaction.commit();
		expect(target).toEqual(["before", "first reward", "nested reward", "first reward end", "between", "second reward", "after"]);
	});

	it("drops the items when the transaction never commits", async () => {
		const target: string[] = [];

		await inTransaction(createTransaction(), () => bufferUntilCommit(target, buffer => {
			buffer.push("granted");
			return Promise.resolve();
		}));

		expect(target).toEqual([]);
	});

	it("drops the items of a failed fill and of its nested buffers even if the transaction commits", async () => {
		const transaction = createTransaction();
		const target: string[] = [];

		await inTransaction(transaction, async () => {
			await expect(bufferUntilCommit(target, async buffer => {
				buffer.push("rolled back reward");
				await bufferUntilCommit(buffer, nestedBuffer => {
					nestedBuffer.push("nested rolled back reward");
					return Promise.resolve();
				});
				throw new Error("credit failed");
			})).rejects.toThrow("credit failed");
		});
		transaction.commit();

		expect(target).toEqual([]);
	});
});
