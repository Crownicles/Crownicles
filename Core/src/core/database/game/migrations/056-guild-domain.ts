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

	// Guild mission fields on player_missions_info table
	await context.addColumn("player_missions_info", "guildMissionId", {
		type: DataTypes.STRING(64), // eslint-disable-line new-cap
		allowNull: true,
		defaultValue: null
	});
	await context.addColumn("player_missions_info", "guildMissionVariant", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});
	await context.addColumn("player_missions_info", "guildMissionObjective", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});
	await context.addColumn("player_missions_info", "guildMissionNumberDone", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 0
	});
	await context.addColumn("player_missions_info", "lastGuildMissionCompleted", {
		type: DataTypes.DATE,
		allowNull: true,
		defaultValue: null
	});
	await context.addColumn("player_missions_info", "guildMissionBlob", {
		type: DataTypes.BLOB,
		allowNull: true,
		defaultValue: null
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await context.removeColumn("player_missions_info", "guildMissionBlob");
	await context.removeColumn("player_missions_info", "lastGuildMissionCompleted");
	await context.removeColumn("player_missions_info", "guildMissionNumberDone");
	await context.removeColumn("player_missions_info", "guildMissionObjective");
	await context.removeColumn("player_missions_info", "guildMissionVariant");
	await context.removeColumn("player_missions_info", "guildMissionId");
	await context.removeColumn("guilds", "trainingGroundLevel");
	await context.removeColumn("guilds", "pantryLevel");
	await context.removeColumn("guilds", "shelterLevel");
	await context.removeColumn("guilds", "shopLevel");
	await context.removeColumn("guilds", "treasury");
}
