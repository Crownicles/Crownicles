import {
	DataTypes, QueryInterface
} from "sequelize";
import { MigrationNameChanger } from "../../../../../../Lib/src/database/MigrationNameChanger";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Renumbered after the develop migrations up to 077: a database that already ran it under a former name skips it
	if (await MigrationNameChanger.changeMigrationNameFromAny(context, ["082-app-push-devices.js", "080-app-push-devices.js"])) {
		return;
	}

	await context.createTable("app_push_devices", {
		token: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(512),
			primaryKey: true
		},
		keycloakId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		platform: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(16),
			allowNull: false
		},
		sandbox: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false
		},
		language: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(8),
			allowNull: false
		},
		updatedAt: DataTypes.DATE,
		createdAt: DataTypes.DATE
	});
	await context.addIndex("app_push_devices", ["keycloakId"]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("app_push_devices");
}
