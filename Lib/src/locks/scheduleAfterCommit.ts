import {
	CLS_TRANSACTION_KEY, getCrowniclesNamespace, getCurrentTransaction
} from "./CLSNamespace";
import type { Transaction } from "sequelize";

type AsyncTask = () => Promise<void>;

function runOutsideTransaction(task: AsyncTask, onError: (error: unknown) => void): void {
	const namespace = getCrowniclesNamespace();
	namespace.run(() => {
		namespace.set(CLS_TRANSACTION_KEY, undefined);
		void task().catch(onError);
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
