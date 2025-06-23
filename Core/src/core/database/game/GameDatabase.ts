import { Database } from "../../../../../Lib/src/database/Database";
import { DataTypes } from "sequelize";
import { getDatabaseConfiguration } from "../../bot/CrowniclesConfig";
import { botConfig } from "../../../index";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";

export class GameDatabase extends Database {
	constructor() {
		super(getDatabaseConfiguration(botConfig, "game"), `${__dirname}/models`, `${__dirname}/migrations`);
	}

	/**
	 * Initialize a GameDatabase instance
	 */
	async init(doMigrations: boolean): Promise<void> {
		await this.connectDatabase();

		const MigrationTable = this.sequelize.define("migrations", {
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true
			},
			name: DataTypes.STRING,
			up: DataTypes.STRING,
			down: DataTypes.STRING
		});

		try {
			const maxId: number = await MigrationTable.max("id");

			if (maxId !== 28) {
				CrowniclesLogger.error("This version of Crownicles includes a new version of migrations. You have to update the bot to the 3.0.0 version first, and after the migrations, you can upgrade the bot to an older version");
				process.exit();
			}

			await MigrationTable.drop();
		}
		catch { /* Ignore */
		}

		await super.init(doMigrations);
	}
}
