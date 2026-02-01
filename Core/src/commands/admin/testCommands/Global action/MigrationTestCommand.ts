import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { LogsDatabase } from "../../../../core/database/logs/LogsDatabase";
import { GameDatabase } from "../../../../core/database/game/GameDatabase";
import { crowniclesInstance } from "../../../../index";

export const commandInfo: ITestCommand = {
	name: "migration",
	commandFormat: "<database> <number>",
	typeWaited: {
		database: TypeKey.STRING,
		number: TypeKey.INTEGER
	},
	description: "Teste les migrations de base de données en effectuant un rollback (down) puis une remise à jour (up). Databases : 'logs' ou 'game'. DANGER : peut corrompre les données"
};

function getDatabaseFromName(databaseName: string): LogsDatabase | GameDatabase {
	if (databaseName === "logs") {
		return crowniclesInstance?.logsDatabase;
	}
	else if (databaseName === "game") {
		return crowniclesInstance!.gameDatabase;
	}
	throw new Error(`Unknown database name "${databaseName}"`);
}

/**
 * Execute the migration test command
 */
const migrationTestCommand: ExecuteTestCommandLike = async (_player, args) => {
	const migrationNumber = parseInt(args[1], 10);

	const database = getDatabaseFromName(args[0]);

	const maxMigration = (await database.umzug.executed()).length;
	if (migrationNumber <= 0 || migrationNumber > maxMigration) {
		throw new Error(`Migration number must be between 1 and ${maxMigration}`);
	}

	await database.umzug.down({ step: maxMigration - migrationNumber + 1 });
	await database.umzug.up();

	return "Migration down puis up effectuée";
};

commandInfo.execute = migrationTestCommand;
