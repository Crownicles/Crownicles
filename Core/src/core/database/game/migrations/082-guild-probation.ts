import {
	DataTypes, QueryInterface
} from "sequelize";
import { MigrationNameChanger } from "../../../../../../Lib/src/database/MigrationNameChanger";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Renumbered after the develop migrations up to 077: a database that already ran it under a former name skips it
	if (await MigrationNameChanger.changeMigrationNameFromAny(context, ["081-guild-probation.js", "079-guild-probation.js"])) {
		return;
	}

	// Members already in a guild keep full access to its shelter: only those joining from now on are on probation
	await context.addColumn("players", "guildJoinedAt", {
		type: DataTypes.DATE,
		allowNull: true,
		defaultValue: null
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("players", "guildJoinedAt");
}
