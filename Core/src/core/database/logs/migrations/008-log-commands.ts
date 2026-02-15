import {
	DataTypes, QueryInterface
} from "sequelize";
import { LogsCompaction } from "../LogsCompaction";
import { CommandProfilePacketReq } from "../../../../../../Lib/src/packets/commands/CommandProfilePacket";
import { CommandGuildPacketReq } from "../../../../../../Lib/src/packets/commands/CommandGuildPacket";
import { CommandMissionsPacketReq } from "../../../../../../Lib/src/packets/commands/CommandMissionsPacket";
import { CommandTopPacketReq } from "../../../../../../Lib/src/packets/commands/CommandTopPacket";
import { CommandReportPacketReq } from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { CommandDailyBonusPacketReq } from "../../../../../../Lib/src/packets/commands/CommandDailyBonusPacket";
import { CommandGuildShopPacketReq } from "../../../../../../Lib/src/packets/commands/CommandGuildShopPacket";
import { CommandShopPacketReq } from "../../../../../../Lib/src/packets/commands/CommandShopPacket";
import { CommandUpdatePacketReq } from "../../../../../../Lib/src/packets/commands/CommandUpdatePacket";
import { CommandGuildLeavePacketReq } from "../../../../../../Lib/src/packets/commands/CommandGuildLeavePacket";
import { CommandGuildDescriptionPacketReq } from "../../../../../../Lib/src/packets/commands/CommandGuildDescriptionPacket";
import { CommandPetPacketReq } from "../../../../../../Lib/src/packets/commands/CommandPetPacket";
import { CommandGuildInvitePacketReq } from "../../../../../../Lib/src/packets/commands/CommandGuildInvitePacket";
import { CommandRespawnPacketReq } from "../../../../../../Lib/src/packets/commands/CommandRespawnPacket";
import { CommandInventoryPacketReq } from "../../../../../../Lib/src/packets/commands/CommandInventoryPacket";
import { CommandPingPacketReq } from "../../../../../../Lib/src/packets/commands/CommandPingPacket";
import { CommandClassesInfoPacketReq } from "../../../../../../Lib/src/packets/commands/CommandClassesInfoPacket";
import { CommandMapPacketReq } from "../../../../../../Lib/src/packets/commands/CommandMapPacket";
import { CommandUnlockPacketReq } from "../../../../../../Lib/src/packets/commands/CommandUnlockPacket";
import { CommandDrinkPacketReq } from "../../../../../../Lib/src/packets/commands/CommandDrinkPacket";
import { CommandPetFreePacketReq } from "../../../../../../Lib/src/packets/commands/CommandPetFreePacket";
import { CommandGuildKickPacketReq } from "../../../../../../Lib/src/packets/commands/CommandGuildKickPacket";
import { CommandRarityPacketReq } from "../../../../../../Lib/src/packets/commands/CommandRarityPacket";
import { CommandPetSellPacketReq } from "../../../../../../Lib/src/packets/commands/CommandPetSellPacket";
import { CommandGuildElderPacketReq } from "../../../../../../Lib/src/packets/commands/CommandGuildElderPacket";
import { CommandGuildCreatePacketReq } from "../../../../../../Lib/src/packets/commands/CommandGuildCreatePacket";
import { CommandGuildElderRemovePacketReq } from "../../../../../../Lib/src/packets/commands/CommandGuildElderRemovePacket";
import { CommandPetFeedPacketReq } from "../../../../../../Lib/src/packets/commands/CommandPetFeedPacket";
import { CommandGuildShelterPacketReq } from "../../../../../../Lib/src/packets/commands/CommandGuildShelterPacket";
import { CommandGuildDailyPacketReq } from "../../../../../../Lib/src/packets/commands/CommandGuildDailyPacket";
import { CommandGuildStoragePacketReq } from "../../../../../../Lib/src/packets/commands/CommandGuildStoragePacket";
import { CommandSellPacketReq } from "../../../../../../Lib/src/packets/commands/CommandSellPacket";
import { CommandMissionShopPacketReq } from "../../../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import { CommandClassesPacketReq } from "../../../../../../Lib/src/packets/commands/CommandClassesPacket";
import { CommandPetTransferPacketReq } from "../../../../../../Lib/src/packets/commands/CommandPetTransferPacket";
import { CommandPetNickPacketReq } from "../../../../../../Lib/src/packets/commands/CommandPetNickPacket";
import { CommandMaintenancePacketReq } from "../../../../../../Lib/src/packets/commands/CommandMaintenancePacket";
import { CommandLeagueRewardPacketReq } from "../../../../../../Lib/src/packets/commands/CommandLeagueRewardPacket";
import { CommandJoinBoatPacketReq } from "../../../../../../Lib/src/packets/commands/CommandJoinBoatPacket";
import { CommandFightPacketReq } from "../../../../../../Lib/src/packets/commands/CommandFightPacket";
import { CommandEquipPacketReq } from "../../../../../../Lib/src/packets/commands/CommandEquipPacket";

const commandsToPacketNames: Map<string, string> = new Map([
	["profile", CommandProfilePacketReq.name],
	["guild", CommandGuildPacketReq.name],
	["missions", CommandMissionsPacketReq.name],
	["guildshelter", CommandGuildShelterPacketReq.name],
	["top", CommandTopPacketReq.name],
	["report", CommandReportPacketReq.name],
	["help", "[OLD] help"], // Front end command now
	["fight", CommandFightPacketReq.name],
	["language", "[OLD] language"], // Front end command now
	["dailybonus", CommandDailyBonusPacketReq.name],
	["petfeed", CommandPetFeedPacketReq.name],
	["guildshop", CommandGuildShopPacketReq.name],
	["guilddailybonus", CommandGuildDailyPacketReq.name],
	["switch", "[OLD] switch"],
	["equip", CommandEquipPacketReq.name],
	["shop", CommandShopPacketReq.name],
	["update", CommandUpdatePacketReq.name],
	["guildleave", CommandGuildLeavePacketReq.name],
	["guilddescription", CommandGuildDescriptionPacketReq.name],
	["pet", CommandPetPacketReq.name],
	["guildstorage", CommandGuildStoragePacketReq.name],
	["guildinvite", CommandGuildInvitePacketReq.name],
	["respawn", CommandRespawnPacketReq.name],
	["inventory", CommandInventoryPacketReq.name],
	["ping", CommandPingPacketReq.name],
	["pettransfer", CommandPetTransferPacketReq.name],
	["sell", CommandSellPacketReq.name],
	["prefix", "[OLD] prefix"], // Removed command
	["classesinfo", CommandClassesInfoPacketReq.name],
	["map", CommandMapPacketReq.name],
	["missionsshop", CommandMissionShopPacketReq.name],
	["invitedraftbot", "[OLD] invitedraftbot"], // Front end command now
	["vote", "[OLD] vote"], // Front end command now
	["idea", "[OLD] idea"], // Front end command now
	["unlock", CommandUnlockPacketReq.name],
	["drink", CommandDrinkPacketReq.name],
	["petfree", CommandPetFreePacketReq.name],
	["classes", CommandClassesPacketReq.name],
	["sendlogs", "[OLD] sendlogs"], // Removed command
	["guildkick", CommandGuildKickPacketReq.name],
	["badges", "[OLD] badges"], // Front end command now
	["pettrade", "[OLD] pettrade"], // Removed command
	["petnickname", CommandPetNickPacketReq.name],
	["dmnotifications", "[OLD] dmnotifications"], // Front end command now
	["rarity", CommandRarityPacketReq.name],
	["petsell", CommandPetSellPacketReq.name],
	["guildelder", CommandGuildElderPacketReq.name],
	["guildcreate", CommandGuildCreatePacketReq.name],
	["points", "[OLD] points"], // Not coded yet. Will be part of admin front end later
	["money", "[OLD] money"], // Not coded yet. Will be part of admin front end later
	["givebadge", "[OLD] givebadge"], // Not coded yet. Will be part of admin front end later
	["servers", "[OLD] servers"], // Removed command
	["guildelderremove", CommandGuildElderRemovePacketReq.name],
	["changeguildchief", "[OLD] changeguildchief"], // Not coded yet. Will be part of admin front end later
	["unblock", "[OLD] unblock"], // Not coded yet. Will be part of admin front end later
	["notifications", "[OLD] notifications"], // Front end command now
	["resetbadge", "[OLD] resetbadge"], // Not coded yet. Will be part of admin front end later
	["senddm", "[OLD] senddm"], // Front end command now
	["level", "[OLD] level"], // Not coded yet. Will be part of admin front end later
	["leaguebonus", CommandLeagueRewardPacketReq.name],
	["maintenance", CommandMaintenancePacketReq.name],
	["joinboat", CommandJoinBoatPacketReq.name],
	["giveitem", "[OLD] giveitem"] // Not coded yet. Will be part of admin front end later
]);

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	// Create players_commands_stats table
	await context.createTable("players_commands_stats", {
		playerId: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		originId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		subOriginId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		commandId: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		year: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		week: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		},
		count: {
			type: DataTypes.INTEGER.UNSIGNED,
			allowNull: false
		}
	});

	// Compact logs before migrating everything to CPU time
	await LogsCompaction.preVersion5Compaction(context);

	// Migrate commands to packet names
	for (const [command, packetName] of commandsToPacketNames) {
		await context.bulkUpdate("commands", {
			commandName: packetName
		}, { commandName: command });
	}

	// Create command_origins table
	await context.createTable("command_origins", {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false
		}
	});
	await context.insert(null, "command_origins", { name: "discord" });

	// Rename servers to command_sub_origins, change serverId to name and change STRING(20) to TEXT
	await context.renameTable("servers", "command_sub_origins");
	await context.changeColumn("command_sub_origins", "discordId", {
		type: DataTypes.TEXT,
		allowNull: false
	});
	await context.renameColumn("command_sub_origins", "discordId", "name");

	// Change serverId to originId, add subOriginId and make playerId nullable
	await context.renameColumn("players_commands", "serverId", "subOriginId");
	await context.addColumn("players_commands", "originId", {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 1
	});
	await context.changeColumn("players_commands", "playerId", {
		type: DataTypes.INTEGER,
		allowNull: true
	});
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	// Drop players_commands_stats table
	await context.dropTable("players_commands_stats");

	// Migrate packet names back to commands
	for (const [command, packetName] of commandsToPacketNames) {
		await context.bulkUpdate("commands", {
			commandName: command
		}, { commandName: packetName });
	}

	// Drop command_origins table
	await context.dropTable("command_origins");

	// Rename command_sub_origins to servers, change name to discordId and change TEXT to STRING(20)
	await context.renameTable("command_sub_origins", "servers");
	await context.renameColumn("servers", "name", "discordId");
	await context.changeColumn("servers", "discordId", {
		// eslint-disable-next-line new-cap
		type: DataTypes.STRING(20),
		allowNull: false
	});

	// Change originId to serverId, remove subOriginId and make playerId not nullable
	await context.renameColumn("players_commands", "subOriginId", "serverId");
	await context.removeColumn("players_commands", "originId");
	await context.changeColumn("players_commands", "playerId", {
		type: DataTypes.INTEGER,
		allowNull: false
	});
}
