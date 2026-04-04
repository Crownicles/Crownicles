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

	// Guild weekly mission (collective) on guilds table
	await context.addColumn("guilds", "guildMissionId", {
		type: DataTypes.STRING(64), // eslint-disable-line new-cap
		allowNull: true,
		defaultValue: null
	});
	await context.addColumn("guilds", "guildMissionVariant", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});
	await context.addColumn("guilds", "guildMissionObjective", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});
	await context.addColumn("guilds", "guildMissionNumberDone", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});
	await context.addColumn("guilds", "guildMissionBlob", {
		type: DataTypes.BLOB,
		allowNull: true,
		defaultValue: null
	});
	await context.addColumn("guilds", "guildMissionExpiry", {
		type: DataTypes.DATE,
		allowNull: true,
		defaultValue: null
	});

	// Per-player guild mission tracking on player_missions_info
	await context.addColumn("player_missions_info", "guildMissionContribution", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});
	await context.addColumn("player_missions_info", "lastGuildMissionCompleted", {
		type: DataTypes.DATE,
		allowNull: true,
		defaultValue: null
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("player_missions_info", "lastGuildMissionCompleted");
	await context.removeColumn("player_missions_info", "guildMissionContribution");
	await context.removeColumn("guilds", "guildMissionExpiry");
	await context.removeColumn("guilds", "guildMissionBlob");
	await context.removeColumn("guilds", "guildMissionNumberDone");
	await context.removeColumn("guilds", "guildMissionObjective");
	await context.removeColumn("guilds", "guildMissionVariant");
	await context.removeColumn("guilds", "guildMissionId");
	await context.removeColumn("guilds", "trainingGroundLevel");
	await context.removeColumn("guilds", "pantryLevel");
	await context.removeColumn("guilds", "shelterLevel");
	await context.removeColumn("guilds", "shopLevel");
	await context.removeColumn("guilds", "treasury");
}
