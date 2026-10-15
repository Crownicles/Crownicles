import PlayerMissionsInfo, { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import {
	CommandGuildInviteAcceptPacketRes,
	CommandGuildInviteAlreadyInAGuild,
	CommandGuildInviteGuildIsFull,
	CommandGuildInviteInvitedPlayerIsDead,
	CommandGuildInviteInvitedPlayerIsOnPveIsland,
	CommandGuildInviteInvitingPlayerNotInGuild,
	CommandGuildInviteLevelTooLow,
	CommandGuildInvitePendingPacket,
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
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils.js";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { PacketUtils } from "../../core/utils/PacketUtils";
import {
	createGuildInvitationCollector, notifyInvitationAuthor
} from "../../core/utils/GuildInvitationCollector";
import { GuildRole } from "../../../../Lib/src/types/GuildRole";
import {
	Locked, LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";
import {
	attachMemberUnderLock, GUILD_ATTACH_RESULTS, GuildAttachResult
} from "../../core/utils/GuildJoinUtils";

export default class GuildInviteCommand {
	@commandRequires(CommandGuildInvitePacketReq, {
		notBlocked: false,
		guildNeeded: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		guildRoleNeeded: GuildRole.ELDER,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandGuildInvitePacketReq, context: PacketContext): Promise<void> {
		const invitedPlayer = packet.invitedPlayerRank === undefined
			? await Players.getByKeycloakId(packet.invitedPlayerKeycloakId)
			: await Players.getByRank(packet.invitedPlayerRank);
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
			BlockingUtils.unblockPlayer(invitedPlayer.keycloakId, BlockingConstants.REASONS.GUILD_ADD);
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GUILD_ADD);
			if (!reaction || reaction.reaction.type !== ReactionCollectorAcceptReaction.name) {
				response.push(makePacket(CommandGuildInviteRefusePacketRes, {
					invitedPlayerKeycloakId: invitedPlayer.keycloakId,
					guildName: guild!.name
				}));
				notifyInvitationAuthor(context, response);
				return;
			}
			await runAcceptInvitationUnderLock(invitedPlayer, player, guild!, response);
			notifyInvitationAuthor(context, response);
		};

		const collectorPacket = createGuildInvitationCollector(
			collector,
			context,
			invitedPlayer.keycloakId,
			endCallback
		)
			.block(invitedPlayer.keycloakId, BlockingConstants.REASONS.GUILD_ADD)
			.block(player.keycloakId, BlockingConstants.REASONS.GUILD_ADD)
			.build();

		if (context.webSocket) {
			PacketUtils.sendPackets(PacketUtils.webSocketContextForPlayer(context, invitedPlayer.keycloakId), [collectorPacket]);
			response.push(makePacket(CommandGuildInvitePendingPacket, {
				invitedPlayerKeycloakId: invitedPlayer.keycloakId, guildName: guild!.name
			}));
			return;
		}
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

type GuildInviteLocked = {
	invited: Locked<Player>; guild: Locked<Guild>;
};

/**
 * In-lock body for the invite-accept flow: attaches the invited player,
 * then confirms it to both sides.
 */
async function applyLockedAcceptInvitation(
	response: CrowniclesPacket[],
	locked: GuildInviteLocked,
	invitingPlayer: Player
): Promise<GuildAttachResult> {
	const {
		invited, guild
	} = locked;
	const result = await attachMemberUnderLock(response, {
		member: invited, guild
	}, invitingPlayer.keycloakId);
	if (result === GUILD_ATTACH_RESULTS.OK) {
		response.push(makePacket(CommandGuildInviteAcceptPacketRes, {
			guildName: guild.name,
			invitedPlayerKeycloakId: invited.keycloakId
		}));
	}
	return result;
}

/**
 * Outer wrapper that takes the [Player(invited), PlayerMissionsInfo(invited), Guild] row lock
 * and dispatches the right error packet on revalidation failure
 * or concurrent guild destruction.
 */
async function runAcceptInvitationUnderLock(
	invitedPlayer: Locked<Player>,
	invitingPlayer: Locked<Player>,
	guild: Locked<Guild>,
	response: CrowniclesPacket[]
): Promise<void> {
	const packetData = {
		invitedPlayerKeycloakId: invitedPlayer.keycloakId,
		guildName: guild.name
	};

	try {
		await PlayerMissionsInfos.getOfPlayer(invitedPlayer.id);
		const reason = await withLockedEntities(
			[
				Player.lockKey(invitedPlayer.id),
				Guild.lockKey(guild.id),
				PlayerMissionsInfo.lockKey(invitedPlayer.id)
			] as const,
			async ([lockedInvited, lockedGuild]) => await applyLockedAcceptInvitation(
				response,
				{
					invited: lockedInvited, guild: lockedGuild
				},
				invitingPlayer
			)
		);

		if (reason !== GUILD_ATTACH_RESULTS.OK) {
			response.push(makePacket(
				reason === GUILD_ATTACH_RESULTS.GUILD_FULL
					? CommandGuildInviteGuildIsFull
					: CommandGuildInviteAlreadyInAGuild,
				packetData
			));
		}
	}
	catch (error) {
		if (error instanceof LockedRowNotFoundError) {
			/*
			 * The guild was destroyed between the prompt and the
			 * accept. Mirror the original "inviting player not in
			 * guild" outcome.
			 */
			response.push(makePacket(CommandGuildInviteInvitingPlayerNotInGuild, packetData));
			return;
		}
		throw error;
	}
}
