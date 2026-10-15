import { PlantId } from "./PlantId";
import { PlantStorageEntry } from "./HomeChest";

export const GARDEN_OPERATIONS = {
	HARVEST: "harvest", WATER: "water", PLANT: "plant", COMPOST: "compost"
} as const;
export type GardenOperation =
	| { type: typeof GARDEN_OPERATIONS.HARVEST | typeof GARDEN_OPERATIONS.WATER }
	| {
		type: typeof GARDEN_OPERATIONS.PLANT; gardenSlot: number;
	}
	| {
		type: typeof GARDEN_OPERATIONS.COMPOST; plantId: PlantId; quantity: number;
	};
export const GARDEN_ACCESS = {
	FULL: "full", READ_ONLY: "readOnly"
} as const;
export const GARDEN_NO_ACCESS = {
	NO_HOME: "noHome", NO_TALISMAN: "noTalisman", NO_GARDEN: "noGarden"
} as const;
export type GardenNoAccess = typeof GARDEN_NO_ACCESS[keyof typeof GARDEN_NO_ACCESS];
export const GARDEN_ERRORS = {
	NOT_AT_HOME: "notAtHome",
	INVALID_ACTION: "invalidAction",
	NO_READY_PLANTS: "noReadyPlants",
	NO_SEED: "noSeed",
	NO_EMPTY_PLOT: "noEmptyPlot",
	SEED_ALREADY_PLANTED: "seedAlreadyPlanted",
	WATERING_ON_COOLDOWN: "wateringOnCooldown",
	NO_PLANTS_TO_WATER: "noPlantsToWater"
} as const;
export type GardenError = typeof GARDEN_ERRORS[keyof typeof GARDEN_ERRORS];
export type GardenSnapshot = {
	plots: {
		slot: number; plantId: PlantId | 0; growthProgress: number; isReady: boolean; readyAtTimestamp: number;
	}[];
	plantStorage: PlantStorageEntry[];
	hasSeed: boolean;
	seedPlantId: PlantId | 0;
	totalPlots: number;
	accessMode: typeof GARDEN_ACCESS[keyof typeof GARDEN_ACCESS];
	wateringAvailableAt: number | null;
	eligibility: {
		canHarvest: boolean; canPlantSeed: boolean; canWaterGarden: boolean; canCompost: boolean;
	};
};
export type GardenCompostOffer = {
	plantId: PlantId; quantity: number;
};
export type GardenOutcome =
	| {
		kind: "snapshot"; garden: GardenSnapshot; compostOffers: GardenCompostOffer[];
	}
	| {
		kind: "noAccess"; reason: GardenNoAccess;
	}
	| {
		kind: "harvest";
		plantsHarvested: number;
		plantsComposted: number;
		compostResults: {
			plantId: PlantId; materialId: number;
		}[];
		plantStorage: PlantStorageEntry[];
		harvestedSlots: number[];
	}
	| {
		kind: "plant"; plantId: PlantId; gardenSlot: number;
	}
	| {
		kind: "water"; slotsWatered: number; nextWateringAvailableAt: number; slotsBecameReady: number;
	}
	| {
		kind: "compost"; plantId: PlantId; quantity: number; materials: number[];
	}
	| {
		kind: "notEnoughPlants"; plantId: PlantId; quantity: number;
	}
	| {
		kind: "error"; error: GardenError; availableAt?: number;
	}
	| { kind: "closed" };
