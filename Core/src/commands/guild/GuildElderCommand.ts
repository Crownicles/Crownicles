import Player, {Players} from "../../core/database/game/models/Player";
import {DraftBotPacket, makePacket, PacketContext} from "../../../../Lib/src/packets/DraftBotPacket";
import {Guilds} from "../../core/database/game/models/Guild";
import {
	CommandGuildElderAcceptPacketRes,
	CommandGuildElderAlreadyElderPacketRes,
	CommandGuildElderFoundPlayerPacketRes,
	CommandGuildElderHimselfPacketRes,
	CommandGuildElderPacketReq,
	CommandGuildElderRefusePacketRes,
	CommandGuildElderSameGuildPacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildElderPacket";
import {draftBotInstance} from "../../index";
import {commandRequires, CommandUtils} from "../../core/utils/CommandUtils";
import {GuildConstants} from "../../../../Lib/src/constants/GuildConstants";
import {GuildRole} from "../../../../Lib/src/enums/GuildRole";
import {EndCallback, ReactionCollectorInstance} from "../../core/utils/ReactionsCollector";
import {ReactionCollectorAcceptReaction} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {BlockingUtils} from "../../core/utils/BlockingUtils";
import {BlockingConstants} from "../../../../Lib/src/constants/BlockingConstants";
import {ReactionCollectorGuildElder} from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildElder";

/**
 * Return true if promotedPlayer can be promoted
 * @param player
 * @param promotedPlayer
 * @param response
 */
async function isEligible(player: Player, promotedPlayer: Player, response: DraftBotPacket[]): Promise<boolean> {
	if (promotedPlayer === null) {
		response.push(makePacket(CommandGuildElderFoundPlayerPacketRes, {foundPlayer: false}));
		return false;
	}
	let promotedGuild;
	try {
		promotedGuild = await Guilds.getById(promotedPlayer.guildId);
	}
	catch (error) {
		promotedGuild = null;
	}

	const guild = await Guilds.getById(player.guildId);
	if (promotedGuild === null || promotedGuild.id !== player.guildId) {
		response.push(makePacket(CommandGuildElderSameGuildPacketRes, {sameGuild: false}));
		return false;
	}

	if (promotedPlayer.id === player.id) {
		response.push(makePacket(CommandGuildElderHimselfPacketRes, {himself: true}));
		return false;
	}

	if (promotedPlayer.id === guild.elderId) {
		response.push(makePacket(CommandGuildElderAlreadyElderPacketRes, {alreadyElder: true}));
		return false;
	}
	return true;
}

/**
 * Promote promotedPlayer as elder of the guild
 * @param player
 * @param promotedPlayer
 * @param response
 */
async function acceptGuildElder(player: Player, promotedPlayer: Player, response: DraftBotPacket[]): Promise<void> {
	await player.reload();
	if (!await isEligible(player, promotedPlayer, response)) {
		return;
	}
	const guild = await Guilds.getById(player.guildId);
	guild.elderId = promotedPlayer.id;

	await Promise.all([
		promotedPlayer.save(),
		guild.save()
	]);
	draftBotInstance.logsDatabase.logGuildElderAdd(guild, promotedPlayer.keycloakId).then();

	response.push(makePacket(CommandGuildElderAcceptPacketRes, {
		promotedKeycloakId: promotedPlayer.keycloakId,
		guildName: guild.name
	}));
}

export default class GuildElderCommand {
	@commandRequires(CommandGuildElderPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		level: GuildConstants.REQUIRED_LEVEL,
		guildNeeded: true,
		guildRoleNeeded: GuildRole.CHIEF
	})
	async execute(response: DraftBotPacket[], player: Player, packet: CommandGuildElderPacketReq, context: PacketContext): Promise<void> {
		const promotedPlayer = await Players.getAskedPlayer({keycloakId: packet.askedPlayerKeycloakId}, player);

		if (!await isEligible(player, promotedPlayer, response)) {
			return;
		}
		const collector = new ReactionCollectorGuildElder(
			promotedPlayer.keycloakId
		);

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: DraftBotPacket[]): Promise<void> => {
			const reaction = collector.getFirstReaction();
			if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
				await acceptGuildElder(player, promotedPlayer, response);
			}
			else {
				response.push(makePacket(CommandGuildElderRefusePacketRes, {
					promotedKeycloakId: promotedPlayer.keycloakId
				}));
			}
			BlockingUtils.unblockPlayer(player.id, BlockingConstants.REASONS.GUILD_ELDER);
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
			.block(player.id, BlockingConstants.REASONS.GUILD_ELDER)
			.build();

		response.push(collectorPacket);
	}
}