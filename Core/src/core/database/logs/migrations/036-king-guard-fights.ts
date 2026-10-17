import {
	DataTypes, QueryInterface
} from "sequelize";

const KING_GUARD_PROGRESSION_INDEX = "idx_king_guard_player_class";

const KING_GUARD_DATE_INDEX = "idx_king_guard_player_date";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("king_guard_fights_results", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			references: {
				model: "players",
				key: "id"
			},
			onUpdate: "CASCADE",
			onDelete: "CASCADE"
		},
		classId: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		guardClassId: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		guardLevel: {
			type: DataTypes.SMALLINT.UNSIGNED,
			allowNull: false
		},
		turn: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		winner: {
			type: DataTypes.TINYINT.UNSIGNED,
			allowNull: false
		},
		date: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});
	await context.addIndex("king_guard_fights_results", ["playerId", "classId"], { name: KING_GUARD_PROGRESSION_INDEX });
	await context.addIndex("king_guard_fights_results", ["playerId", "date"], { name: KING_GUARD_DATE_INDEX });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("king_guard_fights_results");
}
