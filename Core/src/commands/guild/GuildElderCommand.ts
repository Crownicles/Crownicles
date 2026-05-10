import Player, { Players } from "../../core/database/game/models/Player";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Guild, Guilds
} from "../../core/database/game/models/Guild";
import {
	CommandGuildElderAcceptPacketRes,
	CommandGuildElderAlreadyElderPacketRes,
	CommandGuildElderFoundPlayerPacketRes,
	CommandGuildElderHimselfPacketRes,
	CommandGuildElderPacketReq,
	CommandGuildElderRefusePacketRes,
	CommandGuildElderSameGuildPacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildElderPacket";
import { crowniclesInstance } from "../../index";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { GuildRole } from "../../../../Lib/src/types/GuildRole";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { ReactionCollectorGuildElder } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildElder";
import { GuildStatusChangeNotificationPacket } from "../../../../Lib/src/packets/notifications/GuildStatusChangeNotificationPacket";
import { PacketUtils } from "../../core/utils/PacketUtils";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";

/**
 * Return true if promotedPlayer can be promoted
 * @param player
 * @param promotedPlayer
 * @param response
 */
async function isEligible(player: Player, promotedPlayer: Player | null, response: CrowniclesPacket[]): Promise<boolean> {
	if (promotedPlayer === null) {
		response.push(makePacket(CommandGuildElderFoundPlayerPacketRes, {}));
		return false;
	}
	let promotedGuild;
	try {
		promotedGuild = await Guilds.getById(promotedPlayer.guildId);
	}
	catch {
		promotedGuild = null;
	}

	const guild = await Guilds.getById(player.guildId);
	if (promotedGuild === null || promotedGuild.id !== player.guildId) {
		response.push(makePacket(CommandGuildElderSameGuildPacketRes, {}));
		return false;
	}

	if (promotedPlayer.id === player.id) {
		response.push(makePacket(CommandGuildElderHimselfPacketRes, {}));
		return false;
	}

	if (promotedPlayer.id === guild!.elderId) {
		response.push(makePacket(CommandGuildElderAlreadyElderPacketRes, {}));
		return false;
	}
	return true;
}

type GuildElderLocked = {
	chief: Player; promoted: Player; guild: Guild;
};

/**
 * In-lock body for the elder-promotion flow. Re-validates that
 * the chief still leads the guild and that the promoted player
 * still belongs to it before atomically setting the elder slot.
 */
async function applyLockedAcceptGuildElder(
	response: CrowniclesPacket[],
	locked: GuildElderLocked,
	expectedGuildId: number
): Promise<boolean> {
	const {
		chief, promoted, guild
	} = locked;

	if (chief.guildId !== expectedGuildId || chief.id !== guild.chiefId) {
		return false;
	}
	if (promoted.guildId !== expectedGuildId) {
		return false;
	}
	if (promoted.id === guild.chiefId || promoted.id === guild.elderId) {
		return false;
	}

	guild.elderId = promoted.id;
	await guild.save();

	crowniclesInstance?.logsDatabase.logGuildElderAdd(guild, promoted.keycloakId)
		.then();

	response.push(makePacket(CommandGuildElderAcceptPacketRes, {
		promotedKeycloakId: promoted.keycloakId,
		guildName: guild.name
	}));

	PacketUtils.sendNotifications([
		makePacket(GuildStatusChangeNotificationPacket, {
			keycloakId: promoted.keycloakId,
			becomeElder: true,
			guildName: guild.name
		})
	]);
	return true;
}

/**
 * Promote promotedPlayer as elder of the guild under a row lock.
 *
 * @param player
 * @param promotedPlayer
 * @param response
 */
async function acceptGuildElder(player: Player, promotedPlayer: Player, response: CrowniclesPacket[]): Promise<void> {
	const freshChief = await Players.getById(player.id);
	const freshPromoted = await Players.getById(promotedPlayer.id);

	if (!await isEligible(freshChief, freshPromoted, response)) {
		return;
	}

	const guildSnapshot = (await Guilds.getById(freshChief.guildId))!;

	try {
		const ok = await withLockedEntities(
			[
				Player.lockKey(freshChief.id),
				Player.lockKey(freshPromoted.id),
				Guild.lockKey(guildSnapshot.id)
			] as const,
			async ([
				lockedChief,
				lockedPromoted,
				lockedGuild
			]) => await applyLockedAcceptGuildElder(
				response,
				{
					chief: lockedChief, promoted: lockedPromoted, guild: lockedGuild
				},
				guildSnapshot.id
			)
		);

		if (!ok) {
			response.push(makePacket(CommandGuildElderSameGuildPacketRes, {}));
		}
	}
	catch (error) {
		if (error instanceof LockedRowNotFoundError) {
			/*
			 * The guild was destroyed between the prompt and the
			 * accept. Surface the same "different guild" outcome
			 * the user would have seen if they had been kicked.
			 */
			response.push(makePacket(CommandGuildElderSameGuildPacketRes, {}));
			return;
		}
		throw error;
	}
}

export default class GuildElderCommand {
	@commandRequires(CommandGuildElderPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		level: GuildConstants.REQUIRED_LEVEL,
		guildNeeded: true,
		guildRoleNeeded: GuildRole.CHIEF,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandGuildElderPacketReq, context: PacketContext): Promise<void> {
		const promotedPlayer = await Players.getAskedPlayer({ keycloakId: packet.askedPlayerKeycloakId }, player);

		if (!await isEligible(player, promotedPlayer, response)) {
			return;
		}
		const guildName = (await Guilds.getById(player.guildId))!.name;

		const collector = new ReactionCollectorGuildElder(
			guildName,
			promotedPlayer!.keycloakId
		);

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			const reaction = collector.getFirstReaction();
			if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
				await acceptGuildElder(player, promotedPlayer!, response);
			}
			else {
				response.push(makePacket(CommandGuildElderRefusePacketRes, {
					promotedKeycloakId: promotedPlayer!.keycloakId
				}));
			}
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GUILD_ELDER);
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
			.block(player.keycloakId, BlockingConstants.REASONS.GUILD_ELDER)
			.build();

		response.push(collectorPacket);
	}
}
