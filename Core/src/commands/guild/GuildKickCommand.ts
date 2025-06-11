import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import { Guilds } from "../../core/database/game/models/Guild";
import {
	CommandGuildKickAcceptPacketRes,
	CommandGuildKickBlockedErrorPacket,
	CommandGuildKickPacketReq,
	CommandGuildKickPacketRes,
	CommandGuildKickRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildKickPacket";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { GuildRole } from "../../../../Lib/src/types/GuildRole";
import { ReactionCollectorGuildKick } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildKick";
import { crowniclesInstance } from "../../index";

/**
 * Check if the kicked player is only blocked by this command
 * @param kickedPlayer
 */
function isOnlyBlockedByGuildKick(kickedPlayer: Player): boolean {
	const blockingReasons = BlockingUtils.getPlayerBlockingReason(kickedPlayer.keycloakId);
	return blockingReasons.length === 1 && blockingReasons[0] === BlockingConstants.REASONS.GUILD_KICK;
}

async function acceptGuildKick(player: Player, kickedPlayer: Player, response: CrowniclesPacket[]): Promise<void> {
	await player.reload();

	// Do all necessary checks again just in case something changed during the menu
	if (await isNotEligible(player, kickedPlayer, response)) {
		return;
	}

	const guild = await Guilds.getById(player.guildId);
	kickedPlayer.guildId = null;

	if (guild.elderId === kickedPlayer.id) {
		crowniclesInstance.logsDatabase.logGuildElderRemove(guild, guild.elderId).then();
		guild.elderId = null;
	}
	await Promise.all([
		kickedPlayer.save(),
		guild.save()
	]);
	crowniclesInstance.logsDatabase.logGuildKick(player.keycloakId, guild).then();

	response.push(makePacket(CommandGuildKickAcceptPacketRes, {
		kickedKeycloakId: kickedPlayer.keycloakId,
		guildName: guild.name
	}));
}

/**
 * Check if the player can kick a member from his guild
 * @param player The player who wants to kick a member
 * @param kickedPlayer The player to kick
 * @param response The response to send
 */
async function isNotEligible(player: Player, kickedPlayer: Player, response: CrowniclesPacket[]): Promise<boolean> {
	if (kickedPlayer === null) {
		// No user provided
		response.push(makePacket(CommandGuildKickPacketRes, {
			foundPlayer: false,
			sameGuild: false,
			himself: false
		}));
		return true;
	}

	if (BlockingUtils.isPlayerBlocked(kickedPlayer.keycloakId) && !isOnlyBlockedByGuildKick(kickedPlayer)) {
		// Player is blocked
		response.push(makePacket(CommandGuildKickBlockedErrorPacket, {}));
		return true;
	}

	let kickedGuild;

	// Search for a user's guild
	try {
		kickedGuild = await Guilds.getById(kickedPlayer.guildId);
	}
	catch {
		kickedGuild = null;
	}

	if (kickedGuild === null || kickedGuild.id !== player.guildId) {
		// Different guild
		response.push(makePacket(CommandGuildKickPacketRes, {
			foundPlayer: true,
			sameGuild: false,
			himself: false
		}));
		return true;
	}

	if (kickedPlayer.id === player.id) {
		// Same player
		response.push(makePacket(CommandGuildKickPacketRes, {
			foundPlayer: true,
			sameGuild: true,
			himself: true
		}));
		return true;
	}
	return false;
}

export default class GuildKickCommand {
	@commandRequires(CommandGuildKickPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		level: GuildConstants.REQUIRED_LEVEL,
		guildNeeded: true,
		guildRoleNeeded: GuildRole.CHIEF,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandGuildKickPacketReq, context: PacketContext): Promise<void> {
		const kickedPlayer = await Players.getAskedPlayer(packet.askedPlayer, player);

		if (await isNotEligible(player, kickedPlayer, response)) {
			return;
		}

		BlockingUtils.blockPlayer(kickedPlayer.keycloakId, BlockingConstants.REASONS.GUILD_KICK);

		const guildName = (await Guilds.getById(player.guildId)).name;

		// Send collector
		const collector = new ReactionCollectorGuildKick(
			guildName,
			kickedPlayer.keycloakId
		);

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			const reaction = collector.getFirstReaction();
			if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
				await acceptGuildKick(player, kickedPlayer, response);
			}
			else {
				response.push(makePacket(CommandGuildKickRefusePacketRes, {
					kickedKeycloakId: kickedPlayer.keycloakId
				}));
			}
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GUILD_KICK);
			BlockingUtils.unblockPlayer(kickedPlayer.keycloakId, BlockingConstants.REASONS.GUILD_KICK);
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
			.block(player.keycloakId, BlockingConstants.REASONS.GUILD_KICK)
			.build();

		response.push(collectorPacket);
	}
}
