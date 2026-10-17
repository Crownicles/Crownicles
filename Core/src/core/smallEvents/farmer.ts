import { SmallEventFuncs } from "../../data/SmallEvent";
import { Maps } from "../maps/Maps";
import { MapLinkDataController } from "../../data/MapLink";
import { MapLocationDataController } from "../../data/MapLocation";
import {
	Guilds
} from "../database/game/models/Guild";

import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { giveFoodToGuild } from "../utils/FoodUtils";
import {
	generateRandomItem, giveItemToPlayer
} from "../utils/ItemUtils";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventFarmerPacket } from "../../../../Lib/src/packets/smallEvents/SmallEventFarmerPacket";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { PlayerSmallEvents } from "../database/game/models/PlayerSmallEvent";
import { MapLocationConstants } from "../../../../Lib/src/constants/MapLocationConstants";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { SmallEventConstants } from "../../../../Lib/src/constants/SmallEventConstants";
import { RecipeDiscoveryService } from "../cooking/RecipeDiscoveryService";
import {
	FARMER_RECIPE_COSTS, RecipeDiscoverySource
} from "../../../../Lib/src/constants/CookingConstants";
import { openRecipeShopOffer } from "./recipeShopOffer";
import { RecipeShopSource } from "../../../../Lib/src/packets/interaction/ReactionCollectorRecipeShopSmallEvent";

const FARMER_INTERACTIONS = {
	SALAD: "salad",
	ITEM: "item"
};

const SALAD_AMOUNT = {
	MIN: 1,
	MAX: 3
};

/**
 * Check if the player is on a map link that touches a plains location
 * @param mapLinkId
 */
function isOnPlainsMapLink(mapLinkId: number): boolean {
	const link = MapLinkDataController.instance.getById(mapLinkId);
	if (!link) {
		return false;
	}

	const startLocation = MapLocationDataController.instance.getById(link.startMap);
	const endLocation = MapLocationDataController.instance.getById(link.endMap);

	return startLocation?.type === MapLocationConstants.TYPES.PLAINS || endLocation?.type === MapLocationConstants.TYPES.PLAINS;
}

export const smallEventFuncs: SmallEventFuncs = {
	canBeExecuted: async player => {
		if (!Maps.isOnContinent(player)) {
			return false;
		}
		if (!isOnPlainsMapLink(player.mapLinkId)) {
			return false;
		}
		return await PlayerSmallEvents.playerSmallEventCount(player.id, SmallEventConstants.UNIQUE_EVENT_IDS.FARMER) === 0;
	},
	executeSmallEvent: async (response: CrowniclesPacket[], player, context: PacketContext): Promise<void> => {
		let guild;
		try {
			guild = await Guilds.getById(player.guildId);
		}
		catch {
			guild = null;
		}

		if (!guild || guild.herbivorousFood >= guild.getFoodCapacityFor(PetConstants.PET_FOOD.HERBIVOROUS_FOOD)) {
			// Salad storage is full or no guild — farmer gives a random item instead
			await giveItemToPlayer(response, context, player, generateRandomItem({ maxRarity: ItemRarity.RARE }));
			response.push(makePacket(SmallEventFarmerPacket, { interactionName: FARMER_INTERACTIONS.ITEM }));
			return;
		}

		// Give salad to the guild
		const maxGiveable = guild.getFoodCapacityFor(PetConstants.PET_FOOD.HERBIVOROUS_FOOD) - guild.herbivorousFood;
		const amount = Math.min(RandomUtils.randInt(SALAD_AMOUNT.MIN, SALAD_AMOUNT.MAX + 1), maxGiveable);
		await giveFoodToGuild(response, player, PetConstants.PET_FOOD.HERBIVOROUS_FOOD, amount, NumberChangeReason.SMALL_EVENT);

		// Offer to buy a farmer recipe if one is available and the player can afford it
		const offer = await RecipeDiscoveryService.peekNextDiscovery(player, RecipeDiscoverySource.FARMER, FARMER_RECIPE_COSTS);
		if (offer && player.money >= offer.cost) {
			openRecipeShopOffer({
				response,
				player,
				context,
				source: RecipeShopSource.FARMER,
				offer,
				farmer: {
					interactionName: FARMER_INTERACTIONS.SALAD,
					amount
				}
			});
			return;
		}

		response.push(makePacket(SmallEventFarmerPacket, {
			interactionName: FARMER_INTERACTIONS.SALAD,
			amount
		}));
	}
};
