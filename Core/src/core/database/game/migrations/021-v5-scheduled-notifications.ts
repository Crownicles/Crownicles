import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("scheduled_report_notifications", {
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		keycloakId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		mapId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		scheduledAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		updatedAt: { type: DataTypes.DATE },
		createdAt: { type: DataTypes.DATE }
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("scheduled_report_notifications");
}
