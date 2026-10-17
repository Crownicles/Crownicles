import {
	DataTypes, QueryInterface
} from "sequelize";
import { TournamentLevelLimitModes } from "../../../../../../Lib/src/types/Tournament";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("tournaments", "levelLimitMode", {
		// eslint-disable-next-line new-cap
		type: DataTypes.STRING(16),
		allowNull: false,
		defaultValue: TournamentLevelLimitModes.CATEGORY
	});
	await context.addColumn("tournaments", "levelCap", {
		type: DataTypes.INTEGER,
		allowNull: true
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("tournaments", "levelCap");
	await context.removeColumn("tournaments", "levelLimitMode");
}
