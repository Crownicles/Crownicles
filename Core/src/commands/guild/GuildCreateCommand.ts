import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Player } from "../../core/database/game/models/Player";
import {
	Guild, Guilds
} from "../../core/database/game/models/Guild";
import {
	CommandGuildCreateAcceptPacketRes,
	CommandGuildCreatePacketReq,
	CommandGuildCreatePacketRes,
	CommandGuildCreateRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildCreatePacket";
import { checkNameString } from "../../../../Lib/src/utils/StringUtils";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { ReactionCollectorGuildCreate } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildCreate";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { GuildCreateConstants } from "../../../../Lib/src/constants/GuildCreateConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { LogsDatabase } from "../../core/database/logs/LogsDatabase";
import { MissionsController } from "../../core/missions/MissionsController";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";

/**
 * Check if the player can create a guild with the given name at this exact moment
 * @param player
 * @param guildName
 * @param response
 */
async function canCreateGuild(player: Player, guildName: string, response: CrowniclesPacket[]): Promise<boolean> {
	const guild = player.guildId ? await Guilds.getById(player.guildId) : null;
	const playerMoney = player.money;
	if (guild) {
		response.push(makePacket(CommandGuildCreatePacketRes, {
			playerMoney,
			foundGuild: true
		}));
		return false;
	}
	let existingGuild;
	try {
		existingGuild = await Guilds.getByName(guildName);
	}
	catch {
		existingGuild = null;
	}

	if (existingGuild) {
		// A guild with this name already exists
		response.push(makePacket(CommandGuildCreatePacketRes, {
			playerMoney,
			foundGuild: false,
			guildNameIsAvailable: false
		}));
		return false;
	}

	if (!checkNameString(guildName, GuildConstants.GUILD_NAME_LENGTH_RANGE)) {
		response.push(makePacket(CommandGuildCreatePacketRes, {
			playerMoney,
			foundGuild: false,
			guildNameIsAvailable: true,
			guildNameIsAcceptable: false
		}));
		return false;
	}


	if (playerMoney < GuildCreateConstants.PRICE) {
		response.push(makePacket(CommandGuildCreatePacketRes, {
			playerMoney,
			foundGuild: false,
			guildNameIsAvailable: true,
			guildNameIsAcceptable: true
		}));
		return false;
	}

	return true;
}

async function acceptGuildCreate(player: Player, guildName: string, response: CrowniclesPacket[]): Promise<void> {
	await player.reload();

	// Do all necessary checks again just in case something changed during the menu
	if (!await canCreateGuild(player, guildName, response)) {
		return;
	}

	// Everything is valid, start a guild creation process:
	const newGuild = await Guild.create({
		name: guildName,
		chiefId: player.id
	});
	player.guildId = newGuild.id;
	await player.spendMoney({
		amount: GuildCreateConstants.PRICE,
		response,
		reason: NumberChangeReason.GUILD_CREATE
	});
	newGuild.updateLastDailyAt();
	await newGuild.save();
	await player.save();
	LogsDatabase.logGuildCreation(player.keycloakId, newGuild).then();
	await MissionsController.update(player, response, { missionId: "joinGuild" });
	await MissionsController.update(player, response, {
		missionId: "guildLevel",
		count: newGuild.level,
		set: true
	});

	response.push(makePacket(CommandGuildCreateAcceptPacketRes, { guildName }));
}

export default class GuildCreateCommand {
	@commandRequires(CommandGuildCreatePacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		level: GuildConstants.REQUIRED_LEVEL,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandGuildCreatePacketReq, context: PacketContext): Promise<void> {
		if (!await canCreateGuild(player, packet.askedGuildName, response)) {
			return;
		}

		// Send collector
		const collector = new ReactionCollectorGuildCreate(
			packet.askedGuildName
		);

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			const reaction = collector.getFirstReaction();
			if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
				await acceptGuildCreate(player, packet.askedGuildName, response);
			}
			else {
				response.push(makePacket(CommandGuildCreateRefusePacketRes, {}));
			}
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GUILD_CREATE);
		};

		const collectorPacket = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId],
				reactionLimit: 1
			},
			endCallback
		)
			.block(player.keycloakId, BlockingConstants.REASONS.GUILD_CREATE)
			.build();

		response.push(collectorPacket);
	}
}
