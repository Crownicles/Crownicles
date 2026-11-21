import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("scheduled_garden_notifications", {
		playerId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		type: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(16),
			primaryKey: true
		},
		keycloakId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		scheduledAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		updatedAt: { type: DataTypes.DATE },
		createdAt: { type: DataTypes.DATE }
	});

	await context.addIndex("scheduled_garden_notifications", ["scheduledAt"], {
		name: "idx_scheduled_garden_notifications_scheduledAt"
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("scheduled_garden_notifications");
}
