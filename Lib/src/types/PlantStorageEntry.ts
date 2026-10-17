import { PlantId } from "../constants/PlantConstants";

/**
 * Represents an entry in the home plant storage (harvested plants).
 */
export interface PlantStorageEntry {
	plantId: PlantId;
	quantity: number;
	maxCapacity: number;
}

/**
 * Represents a plant slot in the player's inventory.
 */
export interface PlayerPlantSlotEntry {
	slot: number;
	plantId: PlantId | 0;
}
