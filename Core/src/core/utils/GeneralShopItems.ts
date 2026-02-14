import {
	CommandShopBoughtTooMuchDailyPotions,
	ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { ShopConstants } from "../../../../Lib/src/constants/ShopConstants";
import { ShopItemType } from "../../../../Lib/src/constants/LogsConstants";
import {
	getItemValue, giveItemToPlayer, giveRandomItem
} from "./ItemUtils";
import { Players } from "../database/game/models/Player";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { LogsReadRequests } from "../database/logs/LogsReadRequests";
import {
	Potion, PotionDataController
} from "../../data/Potion";
import { Settings } from "../database/game/models/Setting";
import { MissionsController } from "../missions/MissionsController";

/**
 * Get the shop item for getting a random item
 */
export function getRandomItemShopItem(): ShopItem {
	return {
		id: ShopItemType.RANDOM_ITEM,
		price: ShopConstants.RANDOM_ITEM_PRICE,
		amounts: [1],
		buyCallback: async (response, playerId, context): Promise<boolean> => {
			const player = await Players.getById(playerId);
			await giveRandomItem(context, response, player);
			return true;
		}
	};
}

/**
 * Get the shop item for getting the daily potion
 * @param potion
 */
export function getDailyPotionShopItem(potion: Potion): ShopItem {
	return {
		id: ShopItemType.DAILY_POTION,
		price: Math.round(getItemValue(potion) * ShopConstants.DAILY_POTION_DISCOUNT_MULTIPLIER),
		amounts: [1],
		buyCallback: async (response, playerId, context): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const potionAlreadyPurchased = await LogsReadRequests.getAmountOfDailyPotionsBoughtByPlayer(player.keycloakId);
			if (potionAlreadyPurchased >= ShopConstants.MAX_DAILY_POTION_BUYOUTS) {
				response.push(makePacket(CommandShopBoughtTooMuchDailyPotions, {}));
				return false;
			}
			await giveItemToPlayer(response, context, player, potion);
			if (potionAlreadyPurchased === ShopConstants.MAX_DAILY_POTION_BUYOUTS - 1) {
				await MissionsController.update(player, response, { missionId: "dailyPotionsStock" });
			}
			return true;
		}
	};
}

/**
 * Build the general shop additional data (daily potion info)
 */
export async function getGeneralShopData(keycloakId: string): Promise<{
	potion: Potion;
	remainingPotions: number;
}> {
	const potion = PotionDataController.instance.getById(await Settings.SHOP_POTION.getValue())!;
	const remainingPotions = ShopConstants.MAX_DAILY_POTION_BUYOUTS - await LogsReadRequests.getAmountOfDailyPotionsBoughtByPlayer(keycloakId);
	return {
		potion, remainingPotions
	};
}
