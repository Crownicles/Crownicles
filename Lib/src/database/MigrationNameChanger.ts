import { QueryInterface } from "sequelize";
import { CrowniclesLogger } from "../logs/CrowniclesLogger";

export abstract class MigrationNameChanger {
	/**
	 * Changes the name of a migration in the database. It should always be used in an up method and the migration should stop if it returns true.
	 * @param context The query interface.
	 * @param oldName The old name of the migration.
	 * @returns True if the migration was found and renamed, false otherwise.
	 */
	static async changeMigrationName(context: QueryInterface, oldName: string): Promise<boolean> {
		if ((await context.select(null, "SequelizeMeta", { where: { name: oldName } })).length > 0) {
			// The entry is in fact removed, as the migration entry is added back at the end of the up method
			await context.bulkDelete("SequelizeMeta", { name: oldName });
			CrowniclesLogger.info(`Renamed migration ${oldName}`);
			return true;
		}

		return false;
	}
}
