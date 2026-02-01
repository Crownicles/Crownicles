import {
	CommandGuildInviteAcceptPacketRes,
	CommandGuildInviteAlreadyInAGuild,
	CommandGuildInviteGuildIsFull,
	CommandGuildInviteInvitedPlayerIsDead,
	CommandGuildInviteInvitedPlayerIsOnPveIsland,
	CommandGuildInviteInvitingPlayerNotInGuild,
	CommandGuildInviteLevelTooLow,
	CommandGuildInvitePacketReq,
	CommandGuildInvitePlayerNotFound,
	CommandGuildInviteRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildInvitePacket.js";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket.js";
import {
	Player, Players
} from "../../core/database/game/models/Player.js";
import {
	Guild, Guilds
} from "../../core/database/game/models/Guild.js";
import { Maps } from "../../core/maps/Maps.js";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants.js";
import { ReactionCollectorGuildInvite } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildInvite.js";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector.js";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket.js";
import { BlockingUtils } from "../../core/utils/BlockingUtils.js";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants.js";
import { LogsDatabase } from "../../core/database/logs/LogsDatabase.js";
import { MissionsController } from "../../core/missions/MissionsController.js";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils.js";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { GuildRole } from "../../../../Lib/src/types/GuildRole";

export default class GuildInviteCommand {
	@commandRequires(CommandGuildInvitePacketReq, {
		notBlocked: false,
		guildNeeded: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		guildRoleNeeded: GuildRole.ELDER,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandGuildInvitePacketReq, context: PacketContext): Promise<void> {
		const invitedPlayer = await Players.getByKeycloakId(packet.invitedPlayerKeycloakId);
		if (!invitedPlayer) {
			response.push(makePacket(CommandGuildInvitePlayerNotFound, {}));
			return;
		}

		const guild = player.guildId ? await Guilds.getById(player.guildId) : null;

		if (!await canSendInvite(invitedPlayer, guild, response)) {
			return;
		}

		const collector = new ReactionCollectorGuildInvite(
			guild!.name,
			invitedPlayer.keycloakId
		);

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			const reaction = collector.getFirstReaction();
			await invitedPlayer.reload();
			await player.reload();
			BlockingUtils.unblockPlayer(invitedPlayer.keycloakId, BlockingConstants.REASONS.GUILD_ADD);
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GUILD_ADD);
			if (!reaction || reaction.reaction.type !== ReactionCollectorAcceptReaction.name) {
				response.push(makePacket(CommandGuildInviteRefusePacketRes, {
					invitedPlayerKeycloakId: invitedPlayer.keycloakId,
					guildName: guild!.name
				}));
				return;
			}
			if (!await canSendInvite(invitedPlayer, guild, response)) {
				return;
			}
			await acceptInvitation(invitedPlayer, player, guild!, response);
		};

		const collectorPacket = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId, invitedPlayer.keycloakId],
				reactionLimit: 1
			},
			endCallback
		)
			.block(invitedPlayer.keycloakId, BlockingConstants.REASONS.GUILD_ADD)
			.block(player.keycloakId, BlockingConstants.REASONS.GUILD_ADD)
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
async function canSendInvite(invitedPlayer: Player, guild: Guild | null, response: CrowniclesPacket[]): Promise<boolean> {
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

	if (invitedPlayer.hasAGuild()) {
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

	if (Maps.isOnPveIsland(invitedPlayer) || Maps.isOnBoat(invitedPlayer)) {
		response.push(makePacket(CommandGuildInviteInvitedPlayerIsOnPveIsland, packetData));
		return false;
	}
	return true;
}

async function acceptInvitation(invitedPlayer: Player, invitingPlayer: Player, guild: Guild, response: CrowniclesPacket[]): Promise<void> {
	invitedPlayer.guildId = guild.id;
	guild.updateLastDailyAt();
	await guild.save();
	await invitedPlayer.save();
	LogsDatabase.logGuildJoin(guild, invitedPlayer.keycloakId, invitingPlayer.keycloakId)
		.then();
	await MissionsController.update(invitedPlayer, response, { missionId: "joinGuild" });
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
