import {
	CLS_TRANSACTION_KEY, getCrowniclesNamespace, getCurrentTransaction
} from "./CLSNamespace";
import type { Transaction } from "sequelize";

type AsyncTask = () => Promise<void>;

function runOutsideTransaction(task: AsyncTask, onError: (error: unknown) => void): void {
	const namespace = getCrowniclesNamespace();
	namespace.run(() => {
		namespace.set(CLS_TRANSACTION_KEY, null);
		task().catch(onError);
	});
}

function runAwaitedOutsideTransaction(task: AsyncTask): Promise<void> {
	const namespace = getCrowniclesNamespace();
	return new Promise<void>((resolve, reject) => {
		namespace.run(() => {
			namespace.set(CLS_TRANSACTION_KEY, null);
			task().then(resolve, reject);
		});
	});
}

export function scheduleAfterCommit(task: AsyncTask, onError: (error: unknown) => void, explicitTransaction?: Transaction | null): void {
	const transaction = explicitTransaction === undefined ? getCurrentTransaction() : explicitTransaction;
	if (transaction) {
		transaction.afterCommit(() => runOutsideTransaction(task, onError));
		return;
	}

	runOutsideTransaction(task, onError);
}

/**
 * Runs `task` once the current transaction has committed, outside of any
 * transaction, so the task can open its own short critical sections.
 *
 * Unlike {@link scheduleAfterCommit}, the task is awaited: Sequelize awaits
 * `afterCommit` hooks inside `commit()`, so the outermost `withLockedEntities`
 * only resolves once the task is done and the packets it pushes still reach
 * the caller's response. Errors thrown by the task propagate to that caller,
 * after the commit. Outside any transaction, the task runs immediately.
 *
 * Use it for work that must lock rows owned by other players or by a guild:
 * locking them late from the caller's transaction inverts the canonical lock
 * order and, with MariaDB `innodb_snapshot_isolation`, fails with
 * `ER_CHECKREAD` as soon as one of those rows was committed concurrently.
 */
export async function runAfterCommit(task: AsyncTask): Promise<void> {
	const transaction = getCurrentTransaction();
	if (transaction) {
		transaction.afterCommit(() => runAwaitedOutsideTransaction(task));
		return;
	}

	await runAwaitedOutsideTransaction(task);
}

type BufferedItems = {
	target: unknown[];
	position: number;
	items: unknown[];
	dropped: boolean;
};

const bufferedItemsByTransaction = new WeakMap<Transaction, BufferedItems[]>();

function insertBufferedItems(bufferedItemsList: BufferedItems[]): void {
	/*
	 * Inserted from the last registered to the first: a later buffer of the same target never sits
	 * before an earlier one, so inserting it first keeps the positions of the earlier ones valid,
	 * and a buffer nested in another one is filled before its parent is inserted.
	 */
	for (const bufferedItems of [...bufferedItemsList].reverse()) {
		if (!bufferedItems.dropped) {
			bufferedItems.target.splice(bufferedItems.position, 0, ...bufferedItems.items);
		}
	}
}

/**
 * Runs `fill` with a buffer whose items are inserted into `target` once the current transaction has committed,
 * at the position `target` had when `fill` started, so they keep their order relative to the other items.
 * The items are dropped if the transaction rolls back or if `fill` throws.
 *
 * Use it for packets announcing what the transaction granted: pushed directly, they would reach the player
 * even when a later write fails and rolls the grant back. Outside any transaction, `fill` writes to `target` directly.
 */
export async function bufferUntilCommit<T>(target: T[], fill: (buffer: T[]) => Promise<void>): Promise<void> {
	const transaction = getCurrentTransaction();
	if (!transaction) {
		await fill(target);
		return;
	}

	const bufferedItems: BufferedItems = {
		target,
		position: target.length,
		items: [],
		dropped: false
	};
	let bufferedItemsList = bufferedItemsByTransaction.get(transaction);
	if (!bufferedItemsList) {
		const newBufferedItemsList: BufferedItems[] = [];
		bufferedItemsList = newBufferedItemsList;
		bufferedItemsByTransaction.set(transaction, newBufferedItemsList);
		transaction.afterCommit(() => insertBufferedItems(newBufferedItemsList));
	}

	// Registered before filling, so the buffers nested in this one come after it in the list
	bufferedItemsList.push(bufferedItems);
	try {
		await fill(bufferedItems.items as T[]);
	}
	catch (error) {
		// Flagged rather than emptied: the buffers nested in this one would otherwise fill it again on commit
		bufferedItems.dropped = true;
		throw error;
	}
}
