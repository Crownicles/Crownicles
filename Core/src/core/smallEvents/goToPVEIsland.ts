import { SmallEventFuncs } from "../../data/SmallEvent";
import Player from "../database/game/models/Player";
import { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	SmallEventGoToPVEIslandAcceptPacket,
	SmallEventGoToPVEIslandNoAnswerPacket,
	SmallEventGoToPVEIslandNotEnoughGemsPacket,
	SmallEventGoToPVEIslandRefusePacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventGoToPVEIslandPacket";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import {
	Maps, OptionsStartBoatTravel
} from "../maps/Maps";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import { MissionsController } from "../missions/MissionsController";
import { PlayerSmallEvents } from "../database/game/models/PlayerSmallEvent";
import { LogsReadRequests } from "../database/logs/LogsReadRequests";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { BlockingUtils } from "../utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { ReactionCollectorGoToPVEIsland } from "../../../../Lib/src/packets/interaction/ReactionCollectorGoToPVEIsland";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { TravelTime } from "../maps/TravelTime";

export const smallEventFuncs: SmallEventFuncs = {
	async canBeExecuted(player: Player): Promise<boolean> {
		if (!player.guildId) {
			return false;
		}
		return player.level >= PVEConstants.MIN_LEVEL
			&& Maps.isNearWater(player)
			&& player.hasEnoughEnergyToFight()
			&& await PlayerSmallEvents.playerSmallEventCount(player.id, "goToPVEIsland") === 0
			&& await LogsReadRequests.getCountPVEIslandThisWeek(player.keycloakId, player.guildId) < PVEConstants.TRAVEL_COST.length;
	},

	async executeSmallEvent(response, player, context): Promise<void> {
		const price = await player.getTravelCostThisWeek();
		const anotherMemberOnBoat = await Maps.getGuildMembersOnBoat(player);

		const collector = new ReactionCollectorGoToPVEIsland(
			price,
			player.getCumulativeEnergy(),
			player.getMaxCumulativeEnergy()
		);

		const endCallback: EndCallback = async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]): Promise<void> => {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.PVE_ISLAND);

			const reaction = collector.getFirstReaction();

			if (reaction === null) {
				// Timeout - no response from user
				response.push(makePacket(SmallEventGoToPVEIslandNoAnswerPacket, {}));
			}
			else if (reaction.reaction.type === ReactionCollectorAcceptReaction.name) {
				const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
				if (missionInfo.gems < price) {
					response.push(makePacket(SmallEventGoToPVEIslandNotEnoughGemsPacket, {}));
					return;
				}
				const options: OptionsStartBoatTravel = {
					startTravelTimestamp: Date.now(),
					anotherMemberOnBoat: anotherMemberOnBoat[0],
					price
				};
				const gainScore = await TravelTime.joinBoatScore(player);
				await player.addScore({
					amount: gainScore,
					response,
					reason: NumberChangeReason.SMALL_EVENT
				});

				await Maps.startBoatTravel(player, options, NumberChangeReason.SMALL_EVENT, response);
				await MissionsController.update(player, response, {
					missionId: "joinPVEIsland",
					set: true
				});
				response.push(makePacket(SmallEventGoToPVEIslandAcceptPacket, {
					alone: !anotherMemberOnBoat.length, pointsWon: gainScore
				}));
			}
			else {
				// User clicked refuse button
				response.push(makePacket(SmallEventGoToPVEIslandRefusePacket, {}));
			}
		};

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId],
				reactionLimit: 1
			},
			endCallback
		)
			.block(player.keycloakId, BlockingConstants.REASONS.PVE_ISLAND)
			.build();

		response.push(packet);
	}
};
