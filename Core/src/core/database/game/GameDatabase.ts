import { Database } from "../../../../../Lib/src/database/Database";
import { DataTypes } from "sequelize";
import { getDatabaseConfiguration } from "../../bot/CrowniclesConfig";
import { botConfig } from "../../../bootstrap";
import { CrowniclesLogger } from "../../../../../Lib/src/logs/CrowniclesLogger";
import { CoreConstants } from "../../CoreConstants";

export class GameDatabase extends Database {
	constructor() {
		/*
		 * Tests load this file from source via Vitest, but the model and
		 * migration loaders in `Database` only accept `.js` files (see
		 * `Database#initModelFromFile`). `CoreConstants.DB_BASE_DIR_ENV_VAR`
		 * lets the integration setup point at the compiled `dist/` tree so
		 * the production loader picks up the same `.js` artifacts as a
		 * real deployment. Production leaves the env var unset and falls
		 * back to `__dirname`.
		 */
		const baseDir = process.env[CoreConstants.DB_BASE_DIR_ENV_VAR] ?? __dirname;
		super(getDatabaseConfiguration(botConfig, "game"), `${baseDir}/models`, `${baseDir}/migrations`);
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
