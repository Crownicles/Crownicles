import {
	Sequelize, Transaction
} from "sequelize";
import { getTransactionSequelize } from "../../../../../Lib/src/locks/CLSNamespace";

type TransactionWithParent = Transaction & {
	readonly parent?: TransactionWithParent;
};

export function transactionBelongsToSequelize(transaction: Transaction, sequelize: Sequelize): boolean {
	let currentTransaction: TransactionWithParent | undefined = transaction as TransactionWithParent;
	while (currentTransaction) {
		if (getTransactionSequelize(currentTransaction) !== sequelize) {
			return false;
		}
		currentTransaction = currentTransaction.parent;
	}
	return true;
}
