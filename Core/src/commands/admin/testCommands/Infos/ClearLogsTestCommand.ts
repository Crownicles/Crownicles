import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { crowniclesInstance } from "../../../../index";
import { QueryTypes } from "sequelize";

export const commandInfo: ITestCommand = {
	name: "clearLogs",
	description: "Vide toutes les données des tables de logs (les tables elles-mêmes sont conservées). Utile pour nettoyer avant des tests."
};

/**
 * Clear all data from the logs database tables (without dropping the tables themselves)
 * Uses TRUNCATE to empty tables while preserving their structure
 */
const clearLogsTestCommand: ExecuteTestCommandLike = async () => {
	try {
		// Get all table names from the logs database (excluding migration tracking table)
		const tables = await crowniclesInstance?.logsDatabase.sequelize.query<{ TABLE_NAME: string }>(
			"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME != 'SequelizeMeta'",
			{ type: QueryTypes.SELECT }
		);

		if (!tables || tables.length === 0) {
			return "⚠️ Aucune table trouvée dans la base de données de logs.";
		}

		// Disable foreign key checks temporarily to allow truncating tables with foreign key relationships
		await crowniclesInstance?.logsDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");

		// Truncate each table (empties the table but keeps its structure)
		for (const table of tables) {
			await crowniclesInstance?.logsDatabase.sequelize.query(`TRUNCATE TABLE \`${table.TABLE_NAME}\``);
		}

		// Re-enable foreign key checks
		await crowniclesInstance?.logsDatabase.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");

		return `✅ Données des logs supprimées avec succès ! ${tables.length} tables ont été vidées (structure conservée).`;
	}
	catch (error) {
		return `❌ Erreur lors du nettoyage de la base de données de logs : ${error instanceof Error ? error.message : String(error)}`;
	}
};

commandInfo.execute = clearLogsTestCommand;
