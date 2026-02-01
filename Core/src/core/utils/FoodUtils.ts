import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { Guilds } from "../database/game/models/Guild";
import Player from "../database/game/models/Player";
import {
	CrowniclesPacket, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { NoFoodSpaceInGuildPacket } from "../../../../Lib/src/packets/utils/NoFoodSpaceInGuildPacket";
import { GiveFoodToGuildPacket } from "../../../../Lib/src/packets/utils/GiveFoodToGuildPacket";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { PetFood } from "../../../../Lib/src/types/PetFood";

/**
 * Get the corresponding index in the constants of a given pet food
 * @param food
 */
export function getFoodIndexOf(food: string): number {
	return PetConstants.PET_FOOD_BY_ID.indexOf(food as typeof PetConstants.PET_FOOD_BY_ID[number]);
}

export async function giveFoodToGuild(response: CrowniclesPacket[], player: Player, selectedFood: string, quantity: number, reason: NumberChangeReason): Promise<void> {
	const guild = await Guilds.getById(player.guildId);
	const selectedFoodIndex = getFoodIndexOf(selectedFood);
	if (!guild || guild.isStorageFullFor(selectedFood, quantity)) {
		response.push(makePacket(NoFoodSpaceInGuildPacket, {
			food: selectedFood as PetFood,
			quantity
		}));
		return;
	}
	guild.addFood(selectedFood, quantity, reason);
	await guild.save();
	response.push(makePacket(GiveFoodToGuildPacket, {
		quantity, selectedFoodIndex
	}));
}
