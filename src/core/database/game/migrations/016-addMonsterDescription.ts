import {DataTypes, QueryInterface} from "sequelize";

export async function up({context}: { context: QueryInterface }): Promise<void> {
	await context.addColumn("monsters", "descriptionFr", {
		// eslint-disable-next-line new-cap
		type: DataTypes.STRING(512),
		allowNull: false
	});
	await context.addColumn("monsters", "descriptionEn", {
		// eslint-disable-next-line new-cap
		type: DataTypes.STRING(512),
		allowNull: false
	});
	await context.addColumn("monsters", "emoji", {
		// eslint-disable-next-line new-cap
		type: DataTypes.STRING(10),
		allowNull: false
	});
}

export async function down({context}: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("monsters", "descriptionFr");
	await context.removeColumn("monsters", "descriptionEn");
	await context.removeColumn("monsters", "emoji");
}