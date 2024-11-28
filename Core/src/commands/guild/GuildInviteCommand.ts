import {packetHandler} from "../../core/packetHandlers/PacketHandler.js";
import {
	CommandGuildInviteAcceptPacketRes,
	CommandGuildInviteAlreadyInAGuild,
	CommandGuildInviteGuildIsFull,
	CommandGuildInviteInvitedPlayerIsDead,
	CommandGuildInviteInvitedPlayerIsOnPveIsland,
	CommandGuildInviteInvitingPlayerNotInGuild,
	CommandGuildInviteLevelTooLow,
	CommandGuildInvitePacketReq,
	CommandGuildInviteRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildInvitePacket.js";
import {DraftBotPacket, makePacket, PacketContext} from "../../../../Lib/src/packets/DraftBotPacket.js";
import {Player, Players} from "../../core/database/game/models/Player.js";
import {Guild, Guilds} from "../../core/database/game/models/Guild.js";
import {Maps} from "../../core/maps/Maps.js";
import {GuildConstants} from "../../../../Lib/src/constants/GuildConstants.js";
import {ReactionCollectorGuildInvite} from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildInvite.js";
import {EndCallback, ReactionCollectorInstance} from "../../core/utils/ReactionsCollector.js";
import {ReactionCollectorAcceptReaction} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket.js";
import {BlockingUtils} from "../../core/utils/BlockingUtils.js";
import {BlockingConstants} from "../../../../Lib/src/constants/BlockingConstants.js";
import {LogsDatabase} from "../../core/database/logs/LogsDatabase.js";
import {MissionsController} from "../../core/missions/MissionsController.js";
import {CommandUtils} from "../../core/utils/CommandUtils.js";
import {Effect} from "../../../../Lib/src/enums/Effect.js";

export default class GuildInviteCommand {
	@packetHandler(CommandGuildInvitePacketReq)
	async execute(packet: CommandGuildInvitePacketReq, context: PacketContext, response: DraftBotPacket[]): Promise<void> {
		const invitingPlayer = await Players.getByKeycloakId(context.keycloakId);
		const invitedPlayer = await Players.getByKeycloakId(packet.invitedPlayerkeycloakId);
		const guild = invitingPlayer.guildId ? await Guilds.getById(invitingPlayer.guildId) : null;

		if (!await canSendInvite(invitedPlayer, guild, response)) {
			return;
		}

		if (!await CommandUtils.verifyCommandRequirements(invitingPlayer, context, response, {
			disallowedEffects: [Effect.DEAD, Effect.NOT_STARTED],
			guildNeeded: true,
			guildRoleNeeded: GuildConstants.PERMISSION_LEVEL.ELDER
		})) {
			return;
		}

		const collector = new ReactionCollectorGuildInvite(
			guild.name,
			invitedPlayer.keycloakId
		);

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: DraftBotPacket[]): Promise<void> => {
			const reaction = collector.getFirstReaction();
			await invitedPlayer.reload();
			await invitingPlayer.reload();
			BlockingUtils.unblockPlayer(invitedPlayer.id, BlockingConstants.REASONS.GUILD_ADD);
			BlockingUtils.unblockPlayer(invitingPlayer.id, BlockingConstants.REASONS.GUILD_ADD);
			if (!reaction || reaction.reaction.type !== ReactionCollectorAcceptReaction.name) {
				response.push(makePacket(CommandGuildInviteRefusePacketRes, {
					invitedPlayerKeycloakId: invitedPlayer.keycloakId,
					guildName: guild.name
				}));
				return;
			}
			if (!await canSendInvite(invitedPlayer, guild, response)) {
				return;
			}
			await acceptInvitation(invitedPlayer, invitingPlayer, guild, response);
		};

		const collectorPacket = new ReactionCollectorInstance(
			collector,
			context,
			{
				reactionLimit: 1
			},
			endCallback
		)
			.block(invitedPlayer.id, BlockingConstants.REASONS.GUILD_ADD)
			.block(invitingPlayer.id, BlockingConstants.REASONS.GUILD_ADD)
			.build();

		response.push(collectorPacket);
	}
}

/**
 * Check if the invitation can be sent
 * @param invitedPlayer
 * @param guild
 * @param response
 */
async function canSendInvite(invitedPlayer: Player, guild: Guild, response: DraftBotPacket[]): Promise<boolean> {
	const packetData = {
		invitedPlayerKeycloakId: invitedPlayer.keycloakId,
		guildName: guild?.name
	};

	if (!guild) {
		response.push(makePacket(CommandGuildInviteInvitingPlayerNotInGuild, packetData));
		return false;
	}

	if (invitedPlayer.level < GuildConstants.REQUIRED_LEVEL) {
		response.push(makePacket(CommandGuildInviteLevelTooLow, packetData));
		return false;
	}

	if (invitedPlayer.isInGuild()) {
		response.push(makePacket(CommandGuildInviteAlreadyInAGuild, packetData));
		return false;
	}

	if ((await Players.getByGuild(guild.id)).length === GuildConstants.MAX_GUILD_MEMBERS) {
		response.push(makePacket(CommandGuildInviteGuildIsFull, packetData));
		return false;
	}

	if (invitedPlayer.isDead()) {
		response.push(makePacket(CommandGuildInviteInvitedPlayerIsDead, packetData));
		return false;
	}

	if (Maps.isOnPveIsland(invitedPlayer)) {
		response.push(makePacket(CommandGuildInviteInvitedPlayerIsOnPveIsland, packetData));
		return false;
	}
	return true;
}

async function acceptInvitation(invitedPlayer: Player, invitingPlayer: Player, guild: Guild, response: DraftBotPacket[]): Promise<void> {
	invitedPlayer.guildId = guild.id;
	guild.updateLastDailyAt();
	await guild.save();
	await invitedPlayer.save();
	LogsDatabase.logsGuildJoin(guild, invitedPlayer.keycloakId, invitingPlayer.keycloakId).then();
	await MissionsController.update(invitedPlayer, response, {
		missionId: "guildLevel",
		count: guild.level,
		set: true
	});

	response.push(makePacket(CommandGuildInviteAcceptPacketRes, {
		guildName: guild.name,
		invitedPlayerKeycloakId: invitedPlayer.keycloakId
	}));
}