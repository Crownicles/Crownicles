import { Player } from "../database/game/models/Player";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	BuyCallbackResult,
	CommandShopNoPlantSlotAvailable,
	CommandShopNotEnoughCurrency,
	ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import { ShopCurrency } from "../../../../Lib/src/constants/ShopConstants";
import {
	PlantConstants, PlantId, PlantType
} from "../../../../Lib/src/constants/PlantConstants";
import { MissionsController } from "../missions/MissionsController";
import {
	getPlantReception, getPlantReceptionCapacity, givePlantsUnderLock, PlantReceiver, PlantReception, withLockedPlantReceiver
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

type WeeklyPlantPurchase = {
	response: CrowniclesPacket[];
	amount: number;
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

/**
 * The money check, the delivery, the payment and the mission update share the same lock: a purchase is
 * either fully paid and delivered, or not done at all (#3760)
 */
async function buyWeeklyPlantsUnderLock(receiver: PlantReceiver, offer: WeeklyPlantOffer, purchase: WeeklyPlantPurchase): Promise<BuyCallbackResult> {
	const price = offer.unitPrice * purchase.amount;
	if (receiver.player.money < price) {
		purchase.response.push(makePacket(CommandShopNotEnoughCurrency, {
			missingCurrency: price - receiver.player.money,
			currency: ShopCurrency.MONEY
		}));
		return { success: false };
	}

	const delivery = await givePlantsUnderLock(receiver, {
		plantId: offer.plant.id,
		amount: purchase.amount
	});
	if (!delivery.delivered) {
		purchase.response.push(makePacket(CommandShopNoPlantSlotAvailable, { reason: delivery.reason }));
		return { success: false };
	}

	await receiver.player.spendMoney({
		amount: price,
		response: purchase.response,
		reason: NumberChangeReason.SHOP
	});
	await receiver.player.save();
	if (offer.plant.id === PlantId.ANCIENT_TREE) {
		await MissionsController.update(receiver.player, purchase.response, {
			missionId: "getAncestralTrees",
			count: purchase.amount
		});
	}
	return {
		success: true,
		currencySpent: true,
		...delivery.toHomeStorage > 0 ? { plantsSentToHomeStorage: delivery.toHomeStorage } : {}
	};
}

async function buyWeeklyPlants(offer: WeeklyPlantOffer, purchase: WeeklyPlantPurchase): Promise<BuyCallbackResult> {
	let result: BuyCallbackResult = { success: false };
	await withLockedPlantReceiver(offer.player, "buyWeeklyPlants", async receiver => {
		result = await buyWeeklyPlantsUnderLock(receiver, offer, purchase);
	});
	return result;
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
			buyCallback: (response, _playerId, _context, amount): Promise<BuyCallbackResult> => buyWeeklyPlants(offer, {
				response,
				amount
			})
		};
	}));
}
