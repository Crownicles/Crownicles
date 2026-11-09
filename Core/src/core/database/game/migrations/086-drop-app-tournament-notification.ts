import {
	DataTypes, QueryInterface
} from "sequelize";
import { MigrationNameChanger } from "../../../../../../Lib/src/database/MigrationNameChanger";

// The server tournament mode was removed before release: its app notification setting goes with it.
export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Renumbered after the develop migrations up to 077: a database that already ran it under a former name skips it
	if (await MigrationNameChanger.changeMigrationName(context, "085-drop-app-tournament-notification.js")) {
		return;
	}

	await context.removeColumn("app_notification_preferences", "tournament");
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.addColumn("app_notification_preferences", "tournament", {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: true
	});
}
