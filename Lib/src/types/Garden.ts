import type { ReactionCollectorCityData } from "../packets/interaction/ReactionCollectorCity";
import { PlantId } from "../constants/PlantConstants";
import { GardenConstants } from "../constants/GardenConstants";

export type GardenSnapshot = NonNullable<NonNullable<ReactionCollectorCityData["home"]["owned"]>["garden"]>;
export type GardenCompostOffer = {
	plantId: PlantId; quantity: number;
};
export const GARDEN_OPERATIONS = {
	...GardenConstants.GARDEN_ACTIONS, COMPOST: "compost"
} as const;
export type GardenOperation =
	| { type: typeof GARDEN_OPERATIONS.HARVEST | typeof GARDEN_OPERATIONS.WATER }
	| {
		type: typeof GARDEN_OPERATIONS.PLANT; gardenSlot: number;
	}
	| {
		type: typeof GARDEN_OPERATIONS.COMPOST; plantId: PlantId; quantity: number;
	};
