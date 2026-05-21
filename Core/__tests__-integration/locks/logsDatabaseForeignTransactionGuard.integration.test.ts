import {
	afterAll, beforeAll, beforeEach, describe, expect, it
} from "vitest";
import {
	DataTypes, Model, ModelStatic, Sequelize, Transaction
} from "sequelize";
import {
	setupIntegrationDb, IntegrationTestEnvironment
} from "../_setup";
import { withLockedEntities } from "../../../Lib/src/locks/withLockedEntities";
import {
	CLS_TRANSACTION_KEY
} from "../../../Lib/src/locks/CLSNamespace";
import { transactionBelongsToSequelize } from "../../src/core/database/logs/LogsForeignTransactionGuard";

type SequelizeClsHolder = typeof Sequelize & {
	_cls?: { get: (key: string) => unknown };
};

class GamePetEntity extends Model {
	declare id: number;

	declare creationDate: Date;
}

class LogsPetEntity extends Model {
	declare id: number;

	declare gameId: number;

	declare creationTimestamp: number;
}

let gameEnv: IntegrationTestEnvironment;
let logsEnv: IntegrationTestEnvironment;
let GamePetEntityModel: ModelStatic<GamePetEntity>;
let LogsPetEntityModel: ModelStatic<LogsPetEntity>;

function installLogsQueryGuardForTest(logsSequelize: Sequelize): void {
	const originalQuery = logsSequelize.query.bind(logsSequelize);
	const clsHolder = Sequelize as SequelizeClsHolder;

	const patchedQuery = ((sql: Parameters<typeof originalQuery>[0], rawOptions?: Parameters<typeof originalQuery>[1]): Promise<unknown> => {
		const opts: { transaction?: Transaction | null | undefined } & Record<string, unknown> = { ...rawOptions ?? {} };

		let transaction = opts.transaction;
		if (transaction === undefined && clsHolder._cls) {
			transaction = clsHolder._cls.get(CLS_TRANSACTION_KEY) as Transaction | undefined;
		}
		if (transaction && !transactionBelongsToSequelize(transaction, logsSequelize)) {
			opts.transaction = null;
		}

		return originalQuery(sql, opts as Parameters<typeof originalQuery>[1]);
	}) as typeof logsSequelize.query;
	logsSequelize.query = patchedQuery;
}

beforeAll(async () => {
	gameEnv = await setupIntegrationDb("logs_guard_game");
	logsEnv = await setupIntegrationDb("logs_guard_logs");

	GamePetEntityModel = GamePetEntity.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		creationDate: {
			type: DataTypes.DATE,
			allowNull: false
		}
	}, {
		sequelize: gameEnv.sequelize,
		tableName: "pet_entities",
		timestamps: false
	});
	LogsPetEntityModel = LogsPetEntity.init({
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		gameId: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		creationTimestamp: {
			type: DataTypes.INTEGER,
			allowNull: false
		}
	}, {
		sequelize: logsEnv.sequelize,
		tableName: "pet_entities",
		freezeTableName: true,
		timestamps: false
	});

	installLogsQueryGuardForTest(logsEnv.sequelize);
	await Promise.all([
		gameEnv.sequelize.sync(),
		logsEnv.sequelize.sync()
	]);
}, 60_000);

afterAll(async () => {
	await gameEnv?.teardown();
	await logsEnv?.teardown();
}, 60_000);

beforeEach(async () => {
	await LogsPetEntityModel.destroy({ where: {}, truncate: true });
	await GamePetEntityModel.destroy({ where: {}, truncate: true });
	await GamePetEntityModel.create({
		id: 112,
		creationDate: new Date(0)
	});
});

describe("logs database foreign transaction guard", () => {
	it("keeps findOrCreate on the logs database during a game lock", async () => {
		await withLockedEntities(
			[{ model: GamePetEntityModel, id: 112 }],
			async () => {
				const [logPetEntity, created] = await LogsPetEntityModel.findOrCreate({
					where: {
						gameId: 112,
						creationTimestamp: 1778709002
					}
				});

				expect(created).toBe(true);
				expect(logPetEntity.gameId).toBe(112);
			}
		);

		await expect(LogsPetEntityModel.count()).resolves.toBe(1);
	});
});
