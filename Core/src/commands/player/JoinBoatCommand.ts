import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../../core/database/game/models/Player";
import {
	CommandJoinBoatAcceptPacketRes,
	CommandJoinBoatNoGuildPacketRes,
	CommandJoinBoatNoMemberOnBoatPacketRes,
	CommandJoinBoatNotEnoughEnergyPacketRes,
	CommandJoinBoatNotEnoughGemsPacketRes,
	CommandJoinBoatPacketReq,
	CommandJoinBoatRefusePacketRes,
	CommandJoinBoatTooManyRunsPacketRes
} from "../../../../Lib/src/packets/commands/CommandJoinBoatPacket";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import { LogsReadRequests } from "../../core/database/logs/LogsReadRequests";
import {
	Maps, OptionsStartBoatTravel
} from "../../core/maps/Maps";
import { MissionsController } from "../../core/missions/MissionsController";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	EndCallback, ReactionCollectorInstance
} from "../../core/utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { ReactionCollectorJoinBoat } from "../../../../Lib/src/packets/interaction/ReactionCollectorJoinBoat";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";
import { TravelTime } from "../../core/maps/TravelTime";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";


/**
 * Check if the player can join the boat
 * @param player
 * @param response
 */
async function canJoinBoat(player: Player, response: CrowniclesPacket[]): Promise<boolean> {
	// Check if the player is still part of a guild
	if (!player.guildId) {
		response.push(makePacket(CommandJoinBoatNoGuildPacketRes, {}));
		return false;
	}

	// The player has been on the island too often this week
	if (await LogsReadRequests.getCountPVEIslandThisWeek(player.keycloakId, player.guildId) >= PVEConstants.TRAVEL_COST.length) {
		response.push(makePacket(CommandJoinBoatTooManyRunsPacketRes, {}));
		return false;
	}

	// No guild members on the boat
	const guildOnBoat = await Maps.getGuildMembersOnBoat(player);
	if (guildOnBoat.length === 0) {
		response.push(makePacket(CommandJoinBoatNoMemberOnBoatPacketRes, {}));
		return false;
	}

	// The player doesn't have enough energy
	if (!player.hasEnoughEnergyToFight()) {
		response.push(makePacket(CommandJoinBoatNotEnoughEnergyPacketRes, {}));
		return false;
	}
	return true;
}

/**
 * Handle the acceptation
 * @param player
 * @param response
 */
async function acceptJoinBoat(player: Player, response: CrowniclesPacket[]): Promise<void> {
	await player.reload();
	if (!await canJoinBoat(player, response)) {
		return;
	}

	const price = await player.getTravelCostThisWeek();
	const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
	if (missionInfo.gems < price) {
		response.push(makePacket(CommandJoinBoatNotEnoughGemsPacketRes, {}));
		return;
	}

	// Gain Score
	const gainScore = await TravelTime.calculateScoreOnTeleportation(player);
	const scoreParameters = {
		amount: gainScore,
		response,
		reason: NumberChangeReason.JOIN_BOAT
	};
	await player.addScore(scoreParameters);

	// Start the travel
	const anotherMemberOnBoat = await Maps.getGuildMembersOnBoat(player);
	const options: OptionsStartBoatTravel = {
		startTravelTimestamp: Date.now(),
		anotherMemberOnBoat: anotherMemberOnBoat[0],
		price
	};
	await Maps.startBoatTravel(player, options, NumberChangeReason.PVE_ISLAND, response);
	await MissionsController.update(player, response, { missionId: "joinMemberOnBoat" });
	await MissionsController.update(player, response, {
		missionId: "joinPVEIsland",
		set: true
	});
	response.push(makePacket(CommandJoinBoatAcceptPacketRes, { score: scoreParameters.amount }));
	await player.save();
}

function endCallback(player: Player): EndCallback {
	return async (collector, response): Promise<void> => {
		const reaction = collector.getFirstReaction();
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PVE_ISLAND);
		if (reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
			await acceptJoinBoat(player, response);
		}
		else {
			response.push(makePacket(CommandJoinBoatRefusePacketRes, {}));
		}
	};
}

export default class JoinBoatCommand {
	@commandRequires(CommandJoinBoatPacketReq, {
		notBlocked: true,
		allowedEffects: CommandUtils.ALLOWED_EFFECTS.NO_EFFECT,
		level: PVEConstants.MIN_LEVEL,
		guildNeeded: true,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	async execute(response: CrowniclesPacket[], player: Player, _packet: CommandJoinBoatPacketReq, context: PacketContext): Promise<void> {
		if (!await canJoinBoat(player, response)) {
			return;
		}
		const price = await player.getTravelCostThisWeek();

		const collector = new ReactionCollectorJoinBoat(
			price,
			player.getCumulativeEnergy(),
			player.getMaxCumulativeEnergy()
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
			.block(player.keycloakId, BlockingConstants.REASONS.PVE_ISLAND)
			.build();

		response.push(collectorPacket);
	}
}
