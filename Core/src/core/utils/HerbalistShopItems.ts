import { Player } from "../database/game/models/Player";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	BuyCallbackResult,
	CommandShopNoPlantSlotAvailable,
	ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { ShopItemType } from "../../../../Lib/src/constants/LogsConstants";
import {
	PlantConstants, PlantId, PlantType
} from "../../../../Lib/src/constants/PlantConstants";
import { MissionsController } from "../missions/MissionsController";
import {
	getPlantReception, getPlantReceptionCapacity, givePlantsToPlayer, PlantReception
} from "./PlantDeliveryUtils";

/**
 * Shop item of each weekly plant, in tier order
 */
const WEEKLY_PLANT_TIER_ITEMS: readonly ShopItemType[] = [
	ShopItemType.WEEKLY_PLANT_TIER_1,
	ShopItemType.WEEKLY_PLANT_TIER_2,
	ShopItemType.WEEKLY_PLANT_TIER_3
];

type WeeklyPlantOffer = {
	player: Player;
	plant: PlantType;
	unitPrice: number;
};

/**
 * Without the home storage link, plants are sold one at a time. With it, the player can buy as many as they
 * can both receive and afford.
 */
async function getWeeklyPlantAmounts(offer: WeeklyPlantOffer, reception: PlantReception): Promise<number[]> {
	if (!reception.linkedHomeStorage) {
		return [1];
	}
	const capacity = await getPlantReceptionCapacity(reception, offer.plant.id);
	const affordable = Math.floor(offer.player.money / offer.unitPrice);
	return PlantConstants.getLinkedHerbalistAmounts(Math.min(capacity, affordable));
}

async function buyWeeklyPlants(offer: WeeklyPlantOffer, response: CrowniclesPacket[], amount: number): Promise<BuyCallbackResult> {
	const delivery = await givePlantsToPlayer({
		playerId: offer.player.id,
		plantId: offer.plant.id,
		amount
	});
	if (!delivery.delivered) {
		response.push(makePacket(CommandShopNoPlantSlotAvailable, delivery.linkedToHomeStorage ? { linkedToHomeStorage: true } : {}));
		return { success: false };
	}
	if (offer.plant.id === PlantId.ANCIENT_TREE) {
		await MissionsController.update(offer.player, response, {
			missionId: "getAncestralTrees",
			count: amount
		});
	}
	return {
		success: true,
		...delivery.toHomeStorage > 0 ? { plantsSentToHomeStorage: delivery.toHomeStorage } : {}
	};
}

/**
 * Shop items of the weekly plants sold by the herbalist (one per tier)
 */
export async function getWeeklyPlantShopItems(player: Player, weeklyPlants: PlantType[]): Promise<ShopItem[]> {
	const reception = await getPlantReception(player.id);
	return await Promise.all(weeklyPlants.map(async (plant, tierIndex): Promise<ShopItem> => {
		const offer: WeeklyPlantOffer = {
			player,
			plant,
			unitPrice: PlantConstants.getHerbalistPrice(plant)
		};
		return {
			id: WEEKLY_PLANT_TIER_ITEMS[tierIndex],
			price: offer.unitPrice,
			amounts: await getWeeklyPlantAmounts(offer, reception),
			buyCallback: (response, _playerId, _context, amount): Promise<BuyCallbackResult> => buyWeeklyPlants(offer, response, amount)
		};
	}));
}
