import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await context.createTable("global_blessings", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			defaultValue: 1
		},
		poolAmount: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false
		},
		poolThreshold: {
			type: DataTypes.INTEGER,
			defaultValue: 5000,
			allowNull: false
		},
		poolStartedAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		activeBlessingType: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false
		},
		blessingEndAt: {
			type: DataTypes.DATE,
			allowNull: true
		},
		lastTriggeredByKeycloakId: {
			type: DataTypes.STRING,
			allowNull: true
		},
		lastBlessingTriggeredAt: {
			type: DataTypes.DATE,
			allowNull: true
		},
		updatedAt: {
			type: DataTypes.DATE,
			allowNull: false
		},
		createdAt: {
			type: DataTypes.DATE,
			allowNull: false
		}
	});

	await context.bulkInsert("global_blessings", [
		{
			id: 1,
			poolAmount: 0,
			poolThreshold: 5000,
			poolStartedAt: new Date(),
			activeBlessingType: 0,
			blessingEndAt: null,
			lastTriggeredByKeycloakId: null,
			lastBlessingTriggeredAt: null,
			updatedAt: new Date(),
			createdAt: new Date()
		}
	]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.dropTable("global_blessings");
}
