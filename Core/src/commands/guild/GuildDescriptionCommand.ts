import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { GuildRole } from "../../../../Lib/src/types/GuildRole";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player, { Players } from "../../core/database/game/models/Player";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import {
	Guild, Guilds
} from "../../core/database/game/models/Guild";
import { crowniclesInstance } from "../../index";
import { ReactionCollectorGuildDescription } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildDescription";
import {
	CommandGuildDescriptionAcceptPacketRes,
	CommandGuildDescriptionInvalidPacket,
	CommandGuildDescriptionNoGuildPacket,
	CommandGuildDescriptionNotAnElderPacket,
	CommandGuildDescriptionPacketReq,
	CommandGuildDescriptionRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildDescriptionPacket";
import { checkNameString } from "../../../../Lib/src/utils/StringUtils";
import {
	LockedRowNotFoundError, withLockedEntities
} from "../../../../Lib/src/locks/withLockedEntities";

/**
 * Outcome of the in-lock description-edit flow.
 */
type DescriptionOutcome = "ok" | "noGuild" | "notAnElder";

/**
 * In-lock body for the description-edit flow. Re-validates that
 * the locked author still leads the locked guild before
 * committing the description change.
 */
async function applyLockedAcceptGuildDescription(
	locked: {
		player: Player; guild: Guild;
	},
	expected: {
		guildId: number;
	},
	description: string
): Promise<DescriptionOutcome> {
	const {
		player, guild
	} = locked;

	if (player.guildId !== expected.guildId) {
		return "noGuild";
	}
	if (!guild.isChiefOrElder(player)) {
		return "notAnElder";
	}

	guild.guildDescription = description;
	await guild.save();

	crowniclesInstance?.logsDatabase.logGuildDescriptionChange(player.keycloakId, guild)
		.then();

	return "ok";
}

async function acceptGuildDescription(player: Player, description: string, response: CrowniclesPacket[]): Promise<void> {
	const fresh = await Players.getById(player.id);
	if (!fresh.guildId) {
		response.push(makePacket(CommandGuildDescriptionNoGuildPacket, {}));
		return;
	}

	try {
		const outcome = await withLockedEntities(
			[Player.lockKey(fresh.id), Guild.lockKey(fresh.guildId)] as const,
			async ([lockedPlayer, lockedGuild]) => await applyLockedAcceptGuildDescription(
				{
					player: lockedPlayer, guild: lockedGuild
				},
				{ guildId: fresh.guildId! },
				description
			)
		);

		if (outcome === "noGuild") {
			response.push(makePacket(CommandGuildDescriptionNoGuildPacket, {}));
		}
		else if (outcome === "notAnElder") {
			response.push(makePacket(CommandGuildDescriptionNotAnElderPacket, {}));
		}
		else {
			response.push(makePacket(CommandGuildDescriptionAcceptPacketRes, {}));
		}
	}
	catch (error) {
		if (error instanceof LockedRowNotFoundError) {
			response.push(makePacket(CommandGuildDescriptionNoGuildPacket, {}));
			return;
		}
		throw error;
	}
}

function endCallback(player: Player, description: string): EndCallback {
	return async (collector, response): Promise<void> => {
		const reaction = collector.getFirstReaction();
		if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
			await acceptGuildDescription(player, description, response);
		}
		else {
			response.push(makePacket(CommandGuildDescriptionRefusePacketRes, {}));
		}
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GUILD_DESCRIPTION);
	};
}

export default class GuildDescriptionCommand {
	@commandRequires(CommandGuildDescriptionPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		level: GuildConstants.REQUIRED_LEVEL,
		guildNeeded: true,
		guildRoleNeeded: GuildRole.ELDER,
		whereAllowed: CommandUtils.WHERE.EVERYWHERE
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandGuildDescriptionPacketReq, context: PacketContext): Promise<void> {
		if (!player.guildId) {
			response.push(makePacket(CommandGuildDescriptionNoGuildPacket, {}));
			return;
		}
		const guild = (await Guilds.getById(player.guildId))!;
		if (!guild.isChiefOrElder(player)) {
			response.push(makePacket(CommandGuildDescriptionNotAnElderPacket, {}));
			return;
		}

		if (!checkNameString(packet.description, GuildConstants.DESCRIPTION_LENGTH_RANGE)) {
			response.push(makePacket(CommandGuildDescriptionInvalidPacket, {
				min: GuildConstants.DESCRIPTION_LENGTH_RANGE.MIN,
				max: GuildConstants.DESCRIPTION_LENGTH_RANGE.MAX
			}));
			return;
		}

		const collector = new ReactionCollectorGuildDescription(
			packet.description
		);

		const collectorPacket = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId],
				reactionLimit: 1
			},
			endCallback(player, packet.description)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.GUILD_DESCRIPTION)
			.build();

		response.push(collectorPacket);
	}
}
