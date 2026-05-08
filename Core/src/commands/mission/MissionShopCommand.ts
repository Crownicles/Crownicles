import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Player, Players
} from "../../core/database/game/models/Player";
import {
	commandRequires, CommandUtils
} from "../../core/utils/CommandUtils";
import {
	CommandShopClosed, ShopCategory, ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { ShopUtils } from "../../core/utils/ShopUtils";
import {
	CommandMissionShopAlreadyHadBadge,
	CommandMissionShopBadge,
	CommandMissionShopNoMissionToSkip,
	CommandMissionShopPacketReq,
	CommandMissionShopSkipMissionResult
} from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import { ShopCurrency } from "../../../../Lib/src/constants/ShopConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import { MissionsController } from "../../core/missions/MissionsController";
import { crowniclesInstance } from "../../index";
import { PlayerMissionsInfos } from "../../core/database/game/models/PlayerMissionsInfo";

import {
	MissionSlot, MissionSlots
} from "../../core/database/game/models/MissionSlot";
import { ReactionCollectorInstance } from "../../core/utils/ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../../core/utils/BlockingUtils";
import {
	ReactionCollectorSkipMissionShopItem,
	ReactionCollectorSkipMissionShopItemCloseReaction,
	ReactionCollectorSkipMissionShopItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorSkipMissionShopItem";
import { WhereAllowed } from "../../../../Lib/src/types/WhereAllowed";
import { Badge } from "../../../../Lib/src/types/Badge";
import { PlayerBadgesManager } from "../../core/database/game/models/PlayerBadges";

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
		await playerMissionsInfo.spendGems(Constants.MISSION_SHOP.PRICES.MISSION_SKIP, response, NumberChangeReason.MISSION_SHOP);
	};
}

/**
 * Creates the skip mission shop item configuration
 * @returns Shop item for skipping and replacing a current mission
 */
function getSkipMapMissionShopItem(): ShopItem {
	return {
		id: ShopItemType.SKIP_MISSION,
		price: Constants.MISSION_SHOP.PRICES.MISSION_SKIP,
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
 * Creates the badge shop item configuration
 * @returns Shop item for purchasing the quest master badge
 */
function getBadgeShopItem(): ShopItem {
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

export default class MissionShopCommand {
	@commandRequires(CommandMissionShopPacketReq, {
		notBlocked: true,
		disallowedEffects: CommandUtils.DISALLOWED_EFFECTS.NOT_STARTED_OR_DEAD_OR_JAILED,
		whereAllowed: [WhereAllowed.CONTINENT]
	})
	static async execute(
		response: CrowniclesPacket[],
		player: Player,
		_packet: CommandMissionShopPacketReq,
		context: PacketContext
	): Promise<void> {
		const shopCategories: ShopCategory[] = [
			{
				id: "utilitaries",
				items: [getSkipMapMissionShopItem()]
			},
			{
				id: "prestige",
				items: [getBadgeShopItem()]
			}
		];

		await ShopUtils.createAndSendShopCollector(context, response, {
			shopCategories,
			player,
			logger: crowniclesInstance?.logsDatabase.logMissionShopBuyout,
			additionalShopData: {
				currency: ShopCurrency.GEM
			}
		});
	}
}
