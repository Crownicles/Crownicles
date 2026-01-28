import {
	Shop, ShopSmallEventItem
} from "./interfaces/Shop";
import { GenericItem } from "../../data/GenericItem";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { generateRandomItem } from "../utils/ItemUtils";
import {
	ItemCategory, ItemRarity
} from "../../../../Lib/src/constants/ItemConstants";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventFuncs } from "../../data/SmallEvent";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import Player from "../database/game/models/Player";
import {
	SmallEventEpicItemShopAcceptPacket,
	SmallEventEpicItemShopCannotBuyPacket,
	SmallEventEpicItemShopRefusePacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventEpicItemShopPacket";
import {
	ReactionCollectorEpicShopSmallEvent,
	ReactionCollectorEpicShopSmallEventData
} from "../../../../Lib/src/packets/interaction/ReactionCollectorEpicShopSmallEvent";
import { MissionsController } from "../missions/MissionsController";

class ShopSmallEvent extends Shop<
	SmallEventEpicItemShopAcceptPacket,
	SmallEventEpicItemShopRefusePacket,
	SmallEventEpicItemShopCannotBuyPacket,
	ReactionCollectorEpicShopSmallEvent
> {
	getPriceMultiplier(player: Player): number {
		const destination = player.getDestination()!;
		const origin = player.getPreviousMap()!;
		if (destination.id === MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS || origin.id === MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS) {
			return SmallEventConstants.EPIC_ITEM_SHOP.ROAD_OF_WONDERS_MULTIPLIER;
		}
		return RandomUtils.crowniclesRandom.bool(SmallEventConstants.EPIC_ITEM_SHOP.GREAT_DEAL_PROBABILITY)
			? SmallEventConstants.EPIC_ITEM_SHOP.GREAT_DEAL_MULTIPLAYER
			: SmallEventConstants.EPIC_ITEM_SHOP.BASE_MULTIPLIER;
	}

	getRandomItem(): GenericItem {
		return generateRandomItem({
			// We exclude potions from the list of possible items
			itemCategory: RandomUtils.crowniclesRandom.pick([
				ItemCategory.WEAPON,
				ItemCategory.ARMOR,
				ItemCategory.OBJECT
			]),
			minRarity: ItemRarity.EPIC,
			maxRarity: ItemRarity.LEGENDARY
		});
	}

	getAcceptPacket(): SmallEventEpicItemShopAcceptPacket {
		return makePacket(SmallEventEpicItemShopAcceptPacket, {});
	}

	getRefusePacket(): SmallEventEpicItemShopRefusePacket {
		return makePacket(SmallEventEpicItemShopRefusePacket, {});
	}

	getCannotBuyPacket(): SmallEventEpicItemShopCannotBuyPacket {
		return makePacket(SmallEventEpicItemShopCannotBuyPacket, {});
	}

	getPopulatedReactionCollector(basePacket: ReactionCollectorEpicShopSmallEventData, shopItem: ShopSmallEventItem): ReactionCollectorEpicShopSmallEvent {
		return new ReactionCollectorEpicShopSmallEvent({
			...basePacket,
			tip: RandomUtils.crowniclesRandom.bool(SmallEventConstants.EPIC_ITEM_SHOP.REDUCTION_TIP_PROBABILITY)
				&& shopItem.multiplier > SmallEventConstants.EPIC_ITEM_SHOP.ROAD_OF_WONDERS_MULTIPLIER
		});
	}

	async afterPurchase(player: Player, _shopItem: ShopSmallEventItem, response: CrowniclesPacket[]): Promise<void> {
		await MissionsController.update(player, response, { missionId: "buyItemFromAlderic" });
	}
}

const shopSmallEvent = new ShopSmallEvent();

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: shopSmallEvent.canBeExecuted,
	executeSmallEvent: shopSmallEvent.executeSmallEvent
};
