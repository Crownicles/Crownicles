import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("scheduled_expedition_notifications", {
		expeditionId: {
			type: DataTypes.INTEGER,
			primaryKey: true
		},
		keycloakId: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(64),
			allowNull: false
		},
		petId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		petSex: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(1),
			allowNull: false
		},
		petNickname: {
			// eslint-disable-next-line new-cap
			type: DataTypes.STRING(16),
			allowNull: true
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
	await context.dropTable("scheduled_expedition_notifications");
}
