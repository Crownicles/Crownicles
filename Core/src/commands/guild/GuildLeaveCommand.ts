import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player, { Players } from "../../core/database/game/models/Player";
import {
	CommandGuildLeaveAcceptPacketRes,
	CommandGuildLeaveNotInAGuildPacketRes,
	CommandGuildLeavePacketReq,
	CommandGuildLeaveRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildLeavePacket";
import { Guilds } from "../../core/database/game/models/Guild";
import { ReactionCollectorGuildLeave } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildLeave";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { crowniclesInstance } from "../../index";
import { LogsDatabase } from "../../core/database/logs/LogsDatabase";
import { PacketUtils } from "../../core/utils/PacketUtils";
import { GuildStatusChangeNotificationPacket } from "../../../../Lib/src/packets/notifications/GuildStatusChangeNotificationPacket";


/**
 * Allow the player to leave its guild
 * @param player
 * @param response
 */
async function acceptGuildLeave(player: Player, response: CrowniclesPacket[]): Promise<void> {
	await player.reload();

	// The player is no longer in a guild since the menu
	if (player.guildId === null) {
		response.push(makePacket(CommandGuildLeaveNotInAGuildPacketRes, {}));
		return;
	}
	const guild = await Guilds.getById(player.guildId);

	// Guild no longer exists
	if (!guild) {
		response.push(makePacket(CommandGuildLeaveNotInAGuildPacketRes, {}));
		return;
	}

	if (player.id === guild.chiefId) {
		// The guild's chief is leaving
		if (guild.elderId !== null) {
			crowniclesInstance.logsDatabase.logGuildElderRemove(guild, guild.elderId).then();
			crowniclesInstance.logsDatabase.logGuildChiefChange(guild, guild.elderId).then();

			// An elder can recover the guild
			player.guildId = null;
			const elder = await Players.getById(guild.elderId);
			guild.elderId = null;
			guild.chiefId = elder.id;
			response.push(makePacket(CommandGuildLeaveAcceptPacketRes, {
				newChiefKeycloakId: elder.keycloakId,
				guildName: guild.name
			}));

			await Promise.all([
				elder.save(),
				guild.save(),
				player.save()
			]);
			const notifications: GuildStatusChangeNotificationPacket[] = [];
			notifications.push(makePacket(GuildStatusChangeNotificationPacket, {
				keycloakId: elder.keycloakId,
				becomeChief: true,
				guildName: guild.name
			}));
			PacketUtils.sendNotifications(notifications);
			return;
		}

		// No elder => the guild will be destroyed
		await guild.completelyDestroyAndDeleteFromTheDatabase();
		response.push(makePacket(CommandGuildLeaveAcceptPacketRes, {
			guildName: guild.name,
			isGuildDestroyed: true
		}));
		return;
	}
	if (guild.elderId === player.id) {
		// The guild's elder is leaving
		crowniclesInstance.logsDatabase.logGuildElderRemove(guild, guild.elderId).then();
		guild.elderId = null;
	}
	LogsDatabase.logGuildLeave(guild, player.keycloakId).then();
	player.guildId = null;
	response.push(makePacket(CommandGuildLeaveAcceptPacketRes, {
		guildName: guild.name
	}));
	await Promise.all([
		player.save(),
		guild.save()
	]);
}

function endCallback(player: Player): EndCallback {
	return async (collector, response): Promise<void> => {
		const reaction = collector.getFirstReaction();
		if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
			await acceptGuildLeave(player, response);
		}
		else {
			response.push(makePacket(CommandGuildLeaveRefusePacketRes, {}));
		}
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GUILD_LEAVE);
	};
}
export default class GuildLeaveCommand {
	@commandRequires(CommandGuildLeavePacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		level: GuildConstants.REQUIRED_LEVEL,
		guildNeeded: true,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandGuildLeavePacketReq, context: PacketContext): Promise<void> {
		const guild = (await Guilds.getById(player.guildId))!;
		const newChief = guild.chiefId === player.id && guild.elderId ? await Players.getById(guild.elderId) : null;

		const collector = new ReactionCollectorGuildLeave(
			guild.name,
			guild.chiefId === player.id && guild.elderId === null,
			newChief?.keycloakId ?? ""
		);

		const collectorPacket = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId],
				reactionLimit: 1
			},
			endCallback(player)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.GUILD_LEAVE)
			.build();

		response.push(collectorPacket);
	}
}
