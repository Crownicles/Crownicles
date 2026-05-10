import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import {
	Guild, Guilds
} from "../../core/database/game/models/Guild";
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
import { GuildKickNotificationPacket } from "../../../../Lib/src/packets/notifications/GuildKickNotificationPacket";
import { PacketUtils } from "../../core/utils/PacketUtils";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";

/**
 * Check if the kicked player is only blocked by this command
 * @param kickedPlayer
 */
function isOnlyBlockedByGuildKick(kickedPlayer: Player): boolean {
	const blockingReasons = BlockingUtils.getPlayerBlockingReason(kickedPlayer.keycloakId);
	return blockingReasons.length === 1 && blockingReasons[0] === BlockingConstants.REASONS.GUILD_KICK;
}

type GuildKickLocked = {
	chief: Player; kicked: Player; guild: Guild;
};

/**
 * In-lock body for the kick flow. Re-validates that the chief
 * still leads the guild and that the kicked player is still a
 * member, then atomically detaches the kicked player and clears
 * the elder slot when applicable.
 */
async function applyLockedAcceptGuildKick(
	response: CrowniclesPacket[],
	locked: GuildKickLocked,
	expectedGuildId: number
): Promise<boolean> {
	const {
		chief, kicked, guild
	} = locked;

	if (chief.guildId !== expectedGuildId || chief.id !== guild.chiefId) {
		return false;
	}
	if (kicked.guildId !== expectedGuildId) {
		return false;
	}

	kicked.guildId = null;

	if (guild.elderId === kicked.id) {
		crowniclesInstance?.logsDatabase.logGuildElderRemove(guild, guild.elderId)
			.then();
		guild.elderId = null;
	}

	await Promise.all([
		kicked.save(),
		guild.save()
	]);

	crowniclesInstance?.logsDatabase.logGuildKick(chief.keycloakId, guild)
		.then();

	response.push(makePacket(CommandGuildKickAcceptPacketRes, {
		kickedKeycloakId: kicked.keycloakId,
		guildName: guild.name
	}));

	PacketUtils.sendNotifications([
		makePacket(GuildKickNotificationPacket, {
			keycloakId: kicked.keycloakId,
			keycloakIdOfExecutor: chief.keycloakId,
			guildName: guild.name
		})
	]);
	return true;
}

async function acceptGuildKick(player: Player, kickedPlayer: Player, response: CrowniclesPacket[]): Promise<void> {
	const freshChief = await Players.getById(player.id);
	const freshKicked = await Players.getById(kickedPlayer.id);

	// Re-run the eligibility checks against the freshly read rows
	if (await isNotEligible(freshChief, freshKicked, response)) {
		return;
	}

	const guildSnapshot = await Guilds.getById(freshChief.guildId);
	if (!guildSnapshot) {
		return;
	}

	try {
		const ok = await withLockedEntities(
			[
				Player.lockKey(freshChief.id),
				Player.lockKey(freshKicked.id),
				Guild.lockKey(guildSnapshot.id)
			] as const,
			async ([
				lockedChief,
				lockedKicked,
				lockedGuild
			]) => await applyLockedAcceptGuildKick(
				response,
				{
					chief: lockedChief, kicked: lockedKicked, guild: lockedGuild
				},
				guildSnapshot.id
			)
		);

		if (!ok) {
			response.push(makePacket(CommandGuildKickPacketRes, {
				foundPlayer: true,
				sameGuild: false,
				himself: false
			}));
		}
	}
	catch (error) {
		if (error instanceof LockedRowNotFoundError) {
			/*
			 * Guild was destroyed between the prompt and the
			 * accept, or the kicked player row vanished. Surface
			 * the same "different guild" outcome the player would
			 * have seen if the guild had already changed.
			 */
			response.push(makePacket(CommandGuildKickPacketRes, {
				foundPlayer: true,
				sameGuild: false,
				himself: false
			}));
			return;
		}
		throw error;
	}
}

/**
 * Check if the player can kick a member from his guild
 * @param player The player who wants to kick a member
 * @param kickedPlayer The player to kick
 * @param response The response to send
 */
async function isNotEligible(player: Player, kickedPlayer: Player | null, response: CrowniclesPacket[]): Promise<boolean> {
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

		// kickedPlayer is guaranteed non-null after isNotEligible check
		const validKickedPlayer = kickedPlayer!;

		BlockingUtils.blockPlayer(validKickedPlayer.keycloakId, BlockingConstants.REASONS.GUILD_KICK);

		const guild = await Guilds.getById(player.guildId);
		if (!guild) {
			return;
		}

		// Send collector
		const collector = new ReactionCollectorGuildKick(
			guild.name,
			validKickedPlayer.keycloakId
		);

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			const reaction = collector.getFirstReaction();
			if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
				await acceptGuildKick(player, validKickedPlayer, response);
			}
			else {
				response.push(makePacket(CommandGuildKickRefusePacketRes, {
					kickedKeycloakId: validKickedPlayer.keycloakId
				}));
			}
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GUILD_KICK);
			BlockingUtils.unblockPlayer(validKickedPlayer.keycloakId, BlockingConstants.REASONS.GUILD_KICK);
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
