import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Player, Players
} from "../database/game/models/Player";
import {
	CommandShopClosed, ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	CommandMissionShopAlreadyHadBadge,
	CommandMissionShopBadge,
	CommandMissionShopNoMissionToSkip,
	CommandMissionShopSkipMissionResult
} from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import { Constants } from "../../../../Lib/src/constants/Constants";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import { MissionsController } from "../missions/MissionsController";
import { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import {
	MissionSlot, MissionSlots
} from "../database/game/models/MissionSlot";
import { ReactionCollectorInstance } from "./ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "./BlockingUtils";
import {
	ReactionCollectorSkipMissionShopItem,
	ReactionCollectorSkipMissionShopItemCloseReaction,
	ReactionCollectorSkipMissionShopItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorSkipMissionShopItem";
import { Badge } from "../../../../Lib/src/types/Badge";
import { PlayerBadgesManager } from "../database/game/models/PlayerBadges";

/**
 * Creates the end callback for the skip mission shop item
 * @param player - The player who is skipping the mission
 * @param missionList - The list of missions available to skip
 * @returns Callback function to handle mission skip completion
 */
function getEndCallbackSkipMissionShopItem(player: Player, missionList: MissionSlot[]): (collector: ReactionCollectorInstance, response: CrowniclesPacket[]) => Promise<void> {
	return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]) => {
		const firstReaction = collector.getFirstReaction();
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.SKIP_MISSION);
		if (!firstReaction || firstReaction.reaction.type === ReactionCollectorSkipMissionShopItemCloseReaction.name) {
			response.push(makePacket(CommandShopClosed, {}));
			return;
		}
		const missionIndex: number = (firstReaction.reaction.data as ReactionCollectorSkipMissionShopItemReaction).missionIndex;
		const mission = missionList[missionIndex];
		await mission.destroy();
		const newMission = await MissionsController.addRandomMissionToPlayer(player, MissionsController.getRandomDifficulty(player), mission.missionId);
		response.push(makePacket(CommandMissionShopSkipMissionResult, {
			oldMission: MissionsController.prepareMissionSlot(mission),
			newMission: MissionsController.prepareMissionSlot(newMission)
		}));
		const playerMissionsInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
		const price = playerMissionsInfo.missionSkipsUsedThisWeek;
		if (price > 0) {
			await playerMissionsInfo.spendGems(price, response, NumberChangeReason.MISSION_SHOP);
		}
		playerMissionsInfo.missionSkipsUsedThisWeek += 1;
		await playerMissionsInfo.save();
	};
}

/**
 * Creates the skip mission shop item configuration.
 * Price is dynamic: it equals the number of skips already used this week
 * (so the first skip of the week is free, the second costs 1 gem, etc.).
 * @param missionSkipsUsedThisWeek - Skip count already used by the player this week
 * @returns Shop item for skipping and replacing a current mission
 */
export function getMissionSkipShopItem(missionSkipsUsedThisWeek: number): ShopItem {
	return {
		id: ShopItemType.SKIP_MISSION,
		price: missionSkipsUsedThisWeek,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number, context: PacketContext): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const missionSlots = await MissionSlots.getOfPlayer(player.id);
			const allMissions = missionSlots.filter(slot => !slot.isCampaign());
			if (!allMissions.length) {
				response.push(makePacket(CommandMissionShopNoMissionToSkip, {}));
				return false;
			}

			const baseMissions = MissionsController.prepareMissionSlots(allMissions);

			const collector = new ReactionCollectorSkipMissionShopItem(baseMissions);

			// Create a reaction collector which will let the player choose the mission he wants to skip
			const packet = new ReactionCollectorInstance(
				collector,
				context,
				{
					allowedPlayerKeycloakIds: [player.keycloakId]
				},
				getEndCallbackSkipMissionShopItem(player, allMissions)
			)
				.block(player.keycloakId, BlockingConstants.REASONS.SKIP_MISSION)
				.build();

			response.push(packet);
			return false;
		}
	};
}

/**
 * Creates the quest master badge shop item configuration
 * @returns Shop item for purchasing the quest master badge
 */
export function getQuestMasterBadgeShopItem(): ShopItem {
	return {
		id: ShopItemType.QUEST_MASTER_BADGE,
		price: Constants.MISSION_SHOP.PRICES.BADGE,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => {
			const player = await Players.getById(playerId);
			if (await PlayerBadgesManager.hasBadge(player.id, Badge.MISSION_COMPLETER)) {
				response.push(makePacket(CommandMissionShopAlreadyHadBadge, {}));
				return false;
			}
			await PlayerBadgesManager.addBadge(player.id, Badge.MISSION_COMPLETER);
			response.push(makePacket(CommandMissionShopBadge, {}));
			return true;
		}
	};
}
