import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Player } from "../../core/database/game/models/Player";
import {
	Guild, Guilds
} from "../../core/database/game/models/Guild";
import {
	CommandGuildCreateAcceptPacketRes,
	CommandGuildCreatePacketReq,
	CommandGuildCreatePacketRes,
	CommandGuildCreateRefusePacketRes
} from "../../../../Lib/src/packets/commands/CommandGuildCreatePacket";
import { checkNameString } from "../../../../Lib/src/utils/StringUtils";
import { GuildConstants } from "../../../../Lib/src/constants/GuildConstants";
import { ReactionCollectorGuildCreate } from "../../../../Lib/src/packets/interaction/ReactionCollectorGuildCreate";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { GuildCreateConstants } from "../../../../Lib/src/constants/GuildCreateConstants";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { LogsDatabase } from "../../core/database/logs/LogsDatabase";
import { MissionsController } from "../../core/missions/MissionsController";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { withLockedEntities } from "../../../../Lib/src/locks/withLockedEntities";

/**
 * Check if the player can create a guild with the given name at this exact moment
 * @param player
 * @param guildName
 * @param response
 */
async function canCreateGuild(player: Player, guildName: string, response: CrowniclesPacket[]): Promise<boolean> {
	const guild = player.guildId ? await Guilds.getById(player.guildId) : null;
	const playerMoney = player.money;
	if (guild) {
		response.push(makePacket(CommandGuildCreatePacketRes, {
			playerMoney,
			foundGuild: true
		}));
		return false;
	}
	let existingGuild;
	try {
		existingGuild = await Guilds.getByName(guildName);
	}
	catch {
		existingGuild = null;
	}

	if (existingGuild) {
		// A guild with this name already exists
		response.push(makePacket(CommandGuildCreatePacketRes, {
			playerMoney,
			foundGuild: false,
			guildNameIsAvailable: false
		}));
		return false;
	}

	if (!checkNameString(guildName, GuildConstants.GUILD_NAME_LENGTH_RANGE)) {
		response.push(makePacket(CommandGuildCreatePacketRes, {
			playerMoney,
			foundGuild: false,
			guildNameIsAvailable: true,
			guildNameIsAcceptable: false
		}));
		return false;
	}


	if (playerMoney < GuildCreateConstants.PRICE) {
		response.push(makePacket(CommandGuildCreatePacketRes, {
			playerMoney,
			foundGuild: false,
			guildNameIsAvailable: true,
			guildNameIsAcceptable: true
		}));
		return false;
	}

	return true;
}

/**
 * Outcome of the in-lock create body. Lets the outer caller
 * surface the right error packet without re-deriving state
 * outside of the critical section.
 */
type GuildCreateOutcome = "OK" | "alreadyInGuild" | "nameTaken" | "noMoney";

type GuildCreateLocked = {
	player: Player;
};

/**
 * In-lock body for the guild-create flow. Re-validates that the
 * locked player has not joined another guild, that the chosen
 * name is still free, and that the player can still afford the
 * price before creating the guild atomically with the player's
 * guildId update and money debit.
 */
async function applyLockedAcceptGuildCreate(
	response: CrowniclesPacket[],
	locked: GuildCreateLocked,
	guildName: string
): Promise<GuildCreateOutcome> {
	const { player } = locked;

	if (player.guildId !== null) {
		return "alreadyInGuild";
	}

	let existingGuild;
	try {
		existingGuild = await Guilds.getByName(guildName);
	}
	catch {
		existingGuild = null;
	}
	if (existingGuild) {
		return "nameTaken";
	}

	if (player.money < GuildCreateConstants.PRICE) {
		return "noMoney";
	}

	const newGuild = await Guild.create({
		name: guildName,
		chiefId: player.id
	});
	player.guildId = newGuild.id;
	await player.spendMoney({
		amount: GuildCreateConstants.PRICE,
		response,
		reason: NumberChangeReason.GUILD_CREATE
	});
	newGuild.updateLastDailyAt();
	await Promise.all([
		newGuild.save(),
		player.save()
	]);
	LogsDatabase.logGuildCreation(player.keycloakId, newGuild)
		.then();
	await MissionsController.update(player, response, { missionId: "joinGuild" });
	await MissionsController.update(player, response, {
		missionId: "guildLevel",
		count: newGuild.level,
		set: true
	});

	response.push(makePacket(CommandGuildCreateAcceptPacketRes, { guildName }));
	return "OK";
}

async function acceptGuildCreate(player: Player, guildName: string, response: CrowniclesPacket[]): Promise<void> {
	const outcome = await withLockedEntities(
		[Player.lockKey(player.id)] as const,
		async ([lockedPlayer]) => await applyLockedAcceptGuildCreate(
			response,
			{ player: lockedPlayer },
			guildName
		)
	);

	if (outcome === "OK") {
		return;
	}

	const playerMoney = player.money;
	if (outcome === "alreadyInGuild") {
		response.push(makePacket(CommandGuildCreatePacketRes, {
			playerMoney,
			foundGuild: true
		}));
	}
	else if (outcome === "nameTaken") {
		response.push(makePacket(CommandGuildCreatePacketRes, {
			playerMoney,
			foundGuild: false,
			guildNameIsAvailable: false
		}));
	}
	else {
		response.push(makePacket(CommandGuildCreatePacketRes, {
			playerMoney,
			foundGuild: false,
			guildNameIsAvailable: true,
			guildNameIsAcceptable: true
		}));
	}
}

export default class GuildCreateCommand {
	@commandRequires(CommandGuildCreatePacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD,
		level: GuildConstants.REQUIRED_LEVEL,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player, packet: CommandGuildCreatePacketReq, context: PacketContext): Promise<void> {
		if (!await canCreateGuild(player, packet.askedGuildName, response)) {
			return;
		}

		// Send collector
		const collector = new ReactionCollectorGuildCreate(
			packet.askedGuildName
		);

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			const reaction = collector.getFirstReaction();
			if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
				await acceptGuildCreate(player, packet.askedGuildName, response);
			}
			else {
				response.push(makePacket(CommandGuildCreateRefusePacketRes, {}));
			}
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.GUILD_CREATE);
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
			.block(player.keycloakId, BlockingConstants.REASONS.GUILD_CREATE)
			.build();

		response.push(collectorPacket);
	}
}
