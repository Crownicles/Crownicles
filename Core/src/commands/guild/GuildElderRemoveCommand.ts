import Player, { Players } from "../../core/database/game/models/Player";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Guild, Guilds
} from "../../core/database/game/models/Guild";
import {
	CommandGuildElderRemoveAcceptPacketRes,
	CommandGuildElderRemoveNoElderPacket,
	CommandGuildElderRemovePacketReq,
	CommandGuildElderRemoveRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildElderRemovePacket";
import { crowniclesInstance } from "../../index";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { ReactionCollectorGuildElderRemove } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildElderRemove";
import { GuildRole } from "../../../../Lib/src/types/GuildRole";
import { GuildStatusChangeNotificationPacket } from "../../../../Lib/src/packets/notifications/GuildStatusChangeNotificationPacket";
import { PacketUtils } from "../../core/utils/PacketUtils";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";

/**
 * In-lock body that clears the elder slot of the locked guild
 * after revalidating chief authority and elder presence.
 */
async function applyLockedAcceptElderRemove(
	response: CrowniclesPacket[],
	locked: {
		chief: Player; guild: Guild;
	},
	expected: {
		guildId: number;
	}
): Promise<{
	ok: boolean; demotedKeycloakId?: string;
}> {
	const {
		chief, guild
	} = locked;

	if (chief.guildId !== expected.guildId || chief.id !== guild.chiefId) {
		return { ok: false };
	}
	if (!guild.elderId) {
		return { ok: false };
	}

	const demotedElderId = guild.elderId;
	const demotedElder = await Players.getById(demotedElderId);
	const demotedKeycloakId = demotedElder.keycloakId;

	guild.elderId = null;
	await guild.save();

	crowniclesInstance?.logsDatabase.logGuildElderRemove(guild, demotedElderId)
		.then();

	response.push(makePacket(CommandGuildElderRemoveAcceptPacketRes, {
		demotedKeycloakId,
		guildName: guild.name
	}));

	PacketUtils.sendNotifications([
		makePacket(GuildStatusChangeNotificationPacket, {
			keycloakId: demotedKeycloakId,
			guildName: guild.name
		})
	]);
	return {
		ok: true, demotedKeycloakId
	};
}

/**
 * Demote demotedElder as a simple member of the guild under a
 * row lock. Locks chief + guild so a concurrent elder leave /
 * promotion / demotion cannot duplicate or contradict the change.
 *
 * @param player
 * @param _demotedElder
 * @param response
 */
async function acceptGuildElderRemove(player: Player, _demotedElder: Player, response: CrowniclesPacket[]): Promise<void> {
	const freshChief = await Players.getById(player.id);
	if (freshChief.guildId === null) {
		response.push(makePacket(CommandGuildElderRemoveNoElderPacket, {}));
		return;
	}
	const guildSnapshot = await Guilds.getById(freshChief.guildId);
	if (!guildSnapshot) {
		response.push(makePacket(CommandGuildElderRemoveNoElderPacket, {}));
		return;
	}

	try {
		const outcome = await withLockedEntities(
			[Player.lockKey(freshChief.id), Guild.lockKey(guildSnapshot.id)] as const,
			async ([lockedChief, lockedGuild]) => await applyLockedAcceptElderRemove(
				response,
				{
					chief: lockedChief, guild: lockedGuild
				},
				{ guildId: guildSnapshot.id }
			)
		);

		if (!outcome.ok) {
			response.push(makePacket(CommandGuildElderRemoveNoElderPacket, {}));
		}
	}
	catch (error) {
		if (error instanceof LockedRowNotFoundError) {
			response.push(makePacket(CommandGuildElderRemoveNoElderPacket, {}));
			return;
		}
		throw error;
	}
}

function endCallback(player: Player, demotedElder: Player): EndCallback {
	return async (collector, response): Promise<void> => {
		const reaction = collector.getFirstReaction();
		if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
			await acceptGuildElderRemove(player, demotedElder, response);
		}
		else {
			response.push(makePacket(CommandGuildElderRemoveRefusePacketRes, { demotedKeycloakId: demotedElder.keycloakId }));
		}
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GUILD_ELDER_REMOVE);
	};
}

export default class GuildElderRemoveCommand {
	@commandRequires(CommandGuildElderRemovePacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		level: GuildConstants.REQUIRED_LEVEL,
		guildNeeded: true,
		guildRoleNeeded: GuildRole.CHIEF,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandGuildElderRemovePacketReq, context: PacketContext): Promise<void> {
		const guild = (await Guilds.getById(player.guildId))!;

		if (!guild.elderId) {
			response.push(makePacket(CommandGuildElderRemoveNoElderPacket, {}));
			return;
		}
		const demotedElder = (await Players.getById(guild.elderId))!;
		const guildName = guild.name;

		const collector = new ReactionCollectorGuildElderRemove(
			guildName,
			demotedElder.keycloakId
		);

		const collectorPacket = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId],
				reactionLimit: 1
			},
			endCallback(player, demotedElder)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.GUILD_ELDER_REMOVE)
			.build();

		response.push(collectorPacket);
	}
}
