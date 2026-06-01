import {
	DataTypes, QueryInterface
} from "sequelize";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Guild domain fields on guilds table
	await context.addColumn("guilds", "treasury", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});

	/*
	 * Initialize treasury with the current guild score so existing guilds start
	 * with available points equal to the points they have already earned.
	 */
	await context.sequelize.query("UPDATE guilds SET treasury = score");
	await context.addColumn("guilds", "shopLevel", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});
	await context.addColumn("guilds", "shelterLevel", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});
	await context.addColumn("guilds", "pantryLevel", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});
	await context.addColumn("guilds", "trainingGroundLevel", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});

	// Guild domain city location
	await context.addColumn("guilds", "domainCityId", {
		type: DataTypes.STRING(64), // eslint-disable-line new-cap
		allowNull: true,
		defaultValue: null
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("guilds", "domainCityId");
	await context.removeColumn("guilds", "trainingGroundLevel");
	await context.removeColumn("guilds", "pantryLevel");
	await context.removeColumn("guilds", "shelterLevel");
	await context.removeColumn("guilds", "shopLevel");
	await context.removeColumn("guilds", "treasury");
}
