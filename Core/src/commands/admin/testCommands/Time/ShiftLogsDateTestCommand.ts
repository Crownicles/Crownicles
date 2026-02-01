import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { crowniclesInstance } from "../../../../index";
import { QueryTypes } from "sequelize";
import { daysToSeconds } from "../../../../../../Lib/src/utils/TimeUtils";

export const commandInfo: ITestCommand = {
	name: "shiftlogsdate",
	aliases: [
		"shiftlogs",
		"logsshift",
		"sld"
	],
	commandFormat: "<days>",
	typeWaited: { days: TypeKey.INTEGER },
	description: "Décale toutes les dates dans la base de données de logs de X jours dans le passé. Utile pour tester les limites hebdomadaires/journalières"
};

/**
 * Shift all dates in the logs database by a given number of days into the past.
 * This updates all columns named 'date' in all tables.
 */
const shiftLogsDateTestCommand: ExecuteTestCommandLike = async (_player, args) => {
	const days = parseInt(args[0], 10);

	if (days === 0) {
		return "⚠️ Le décalage de 0 jours n'a aucun effet.";
	}

	// Calculate seconds to subtract (dates in logs are stored as Unix timestamps in seconds)
	const secondsToShift = daysToSeconds(days);

	try {
		// Get all tables that have a 'date' column
		const tablesWithDate = await crowniclesInstance?.logsDatabase.sequelize.query<{ TABLE_NAME: string }>(
			`SELECT DISTINCT TABLE_NAME 
			 FROM information_schema.COLUMNS 
			 WHERE TABLE_SCHEMA = DATABASE() 
			 AND COLUMN_NAME = 'date' 
			 AND TABLE_NAME != 'SequelizeMeta'`,
			{ type: QueryTypes.SELECT }
		);

		if (!tablesWithDate || tablesWithDate.length === 0) {
			return "⚠️ Aucune table avec une colonne 'date' trouvée dans la base de données de logs.";
		}

		let totalRowsUpdated = 0;

		// Update each table
		for (const table of tablesWithDate) {
			const [, rowsAffected] = await crowniclesInstance?.logsDatabase.sequelize.query(
				`UPDATE \`${table.TABLE_NAME}\` SET date = date - :seconds`,
				{
					replacements: { seconds: secondsToShift },
					type: QueryTypes.UPDATE
				}
			);
			totalRowsUpdated += rowsAffected ?? 0;
		}

		const direction = days > 0 ? "dans le passé" : "dans le futur";
		return `✅ Dates décalées de ${Math.abs(days)} jour(s) ${direction} ! ${tablesWithDate.length} tables mises à jour, ${totalRowsUpdated} entrées modifiées.`;
	}
	catch (error) {
		return `❌ Erreur lors du décalage des dates : ${error instanceof Error ? error.message : String(error)}`;
	}
};

commandInfo.execute = shiftLogsDateTestCommand;
