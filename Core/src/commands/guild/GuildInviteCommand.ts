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
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";

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
			BlockingUtils.unblockPlayer(invitedPlayer.keycloakId, BlockingConstants.REASONS.GUILD_ADD);
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GUILD_ADD);
			if (!reaction || reaction.reaction.type !== ReactionCollectorAcceptReaction.name) {
				response.push(makePacket(CommandGuildInviteRefusePacketRes, {
					invitedPlayerKeycloakId: invitedPlayer.keycloakId,
					guildName: guild!.name
				}));
				return;
			}
			await runAcceptInvitationUnderLock(invitedPlayer, player, guild!, response);
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

/**
 * In-lock body for the invite-accept flow. Re-validates that the
 * invited player has not joined another guild and that the guild
 * still has room before atomically attaching the invited player.
 */
async function applyLockedAcceptInvitation(
	response: CrowniclesPacket[],
	locked: {
		invited: Player; guild: Guild;
	},
	invitingPlayer: Player
): Promise<{
	ok: boolean; reason?: "alreadyInGuild" | "guildFull";
}> {
	const {
		invited, guild
	} = locked;

	if (invited.hasAGuild()) {
		return {
			ok: false, reason: "alreadyInGuild"
		};
	}

	const memberCount = (await Players.getByGuild(guild.id)).length;
	if (memberCount >= GuildConstants.MAX_GUILD_MEMBERS) {
		return {
			ok: false, reason: "guildFull"
		};
	}

	invited.guildId = guild.id;
	guild.updateLastDailyAt();
	await Promise.all([
		invited.save(),
		guild.save()
	]);

	LogsDatabase.logGuildJoin(guild, invited.keycloakId, invitingPlayer.keycloakId)
		.then();
	await MissionsController.update(invited, response, { missionId: "joinGuild" });
	await MissionsController.update(invited, response, {
		missionId: "guildLevel",
		count: guild.level,
		set: true
	});

	response.push(makePacket(CommandGuildInviteAcceptPacketRes, {
		guildName: guild.name,
		invitedPlayerKeycloakId: invited.keycloakId
	}));
	return { ok: true };
}

/**
 * Outer wrapper that takes the [Player(invited), Guild] row lock
 * and dispatches the right error packet on revalidation failure
 * or concurrent guild destruction.
 */
async function runAcceptInvitationUnderLock(
	invitedPlayer: Player,
	invitingPlayer: Player,
	guild: Guild,
	response: CrowniclesPacket[]
): Promise<void> {
	const packetData = {
		invitedPlayerKeycloakId: invitedPlayer.keycloakId,
		guildName: guild.name
	};

	try {
		const outcome = await withLockedEntities(
			[Player.lockKey(invitedPlayer.id), Guild.lockKey(guild.id)] as const,
			async ([lockedInvited, lockedGuild]) => await applyLockedAcceptInvitation(
				response,
				{
					invited: lockedInvited, guild: lockedGuild
				},
				invitingPlayer
			)
		);

		if (!outcome.ok) {
			response.push(makePacket(
				outcome.reason === "guildFull"
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
