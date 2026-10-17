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
