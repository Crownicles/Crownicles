import {Shop} from "./interfaces/Shop";
import {GenericItem} from "../../data/GenericItem";
import {RandomUtils} from "../../../../Lib/src/utils/RandomUtils";
import {SmallEventConstants} from "../../../../Lib/src/constants/SmallEventConstants";
import {generateRandomItem} from "../utils/ItemUtils";
import {ItemCategory, ItemConstants} from "../../../../Lib/src/constants/ItemConstants";
import {makePacket} from "../../../../Lib/src/packets/DraftBotPacket";
import {SmallEventFuncs} from "../../data/SmallEvent";
import {MapConstants} from "../../../../Lib/src/constants/MapConstants";
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

class ShopSmallEvent extends Shop<
	SmallEventEpicItemShopAcceptPacket,
	SmallEventEpicItemShopRefusePacket,
	SmallEventEpicItemShopCannotBuyPacket,
	ReactionCollectorEpicShopSmallEvent
> {
	getPriceMultiplier(player: Player): number {
		const destination = player.getDestination();
		const origin = player.getPreviousMap();
		if (destination.id === MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS || origin.id === MapConstants.LOCATIONS_IDS.ROAD_OF_WONDERS) {
			return SmallEventConstants.EPIC_ITEM_SHOP.ROAD_OF_WONDERS_MULTIPLIER;
		}
		return RandomUtils.draftbotRandom.bool(SmallEventConstants.EPIC_ITEM_SHOP.GREAT_DEAL_PROBABILITY) ?
			SmallEventConstants.EPIC_ITEM_SHOP.GREAT_DEAL_MULTIPLAYER : SmallEventConstants.EPIC_ITEM_SHOP.BASE_MULTIPLIER;
	}

	getRandomItem(): GenericItem {
		
		// We exclude potions from the list of possible items
		const categories = Object.values(ItemCategory).filter(
			(value): value is ItemCategory => value !== ItemCategory.POTION
		);

		const randomCategory = RandomUtils.draftbotRandom.pick(categories);

		return generateRandomItem(
			randomCategory,
			ItemConstants.RARITY.EPIC,
			ItemConstants.RARITY.LEGENDARY
		);
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

	getPopulatedReactionCollector(basePacket: ReactionCollectorEpicShopSmallEventData): ReactionCollectorEpicShopSmallEvent {
		return new ReactionCollectorEpicShopSmallEvent({
			...basePacket,
			tip: RandomUtils.draftbotRandom.bool(SmallEventConstants.EPIC_ITEM_SHOP.REDUCTION_TIP_PROBABILITY)
				&& this.itemMultiplier > SmallEventConstants.EPIC_ITEM_SHOP.ROAD_OF_WONDERS_MULTIPLIER
		});
	}
}

const shopSmallEvent = new ShopSmallEvent();

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: shopSmallEvent.canBeExecuted,
	executeSmallEvent: shopSmallEvent.executeSmallEvent
};
