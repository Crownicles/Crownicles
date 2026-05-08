import Player, { Players } from "../../core/database/game/models/Player";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Guilds } from "../../core/database/game/models/Guild";
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

/**
 * Demote demotedElder as a simple member of the guild
 * @param player
 * @param demotedElder
 * @param response
 */
async function acceptGuildElderRemove(player: Player, demotedElder: Player, response: CrowniclesPacket[]): Promise<void> {
	await player.reload();
	await demotedElder.reload();
	const guild = (await Guilds.getById(player.guildId))!;

	// Do all necessary checks again just in case something changed during the menu
	if (!guild.elderId) {
		response.push(makePacket(CommandGuildElderRemoveNoElderPacket, {}));
		return;
	}
	guild.elderId = null;

	await Promise.all([
		demotedElder.save(),
		guild.save()
	]);
	crowniclesInstance?.logsDatabase.logGuildElderRemove(guild, demotedElder.id).then();

	response.push(makePacket(CommandGuildElderRemoveAcceptPacketRes, {
		demotedKeycloakId: demotedElder.keycloakId,
		guildName: guild.name
	}));
	const notifications: GuildStatusChangeNotificationPacket[] = [];
	notifications.push(makePacket(GuildStatusChangeNotificationPacket, {
		keycloakId: demotedElder.keycloakId,
		guildName: guild.name
	}));
	PacketUtils.sendNotifications(notifications);
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
