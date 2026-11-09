import {
	DataTypes, QueryInterface
} from "sequelize";
import { MigrationNameChanger } from "../../../../../../Lib/src/database/MigrationNameChanger";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Renumbered after the develop migrations up to 077: a database that already ran it under a former name skips it
	if (await MigrationNameChanger.changeMigrationNameFromAny(context, ["084-badge-app-reveal.js", "082-badge-app-reveal.js"])) {
		return;
	}

	await context.addColumn("player_badges", "revealedInApp", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	});

	// Badges owned before the app could celebrate them are not announced as new.
	await context.sequelize.query("UPDATE player_badges SET revealedInApp = TRUE");
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("player_badges", "revealedInApp");
}
