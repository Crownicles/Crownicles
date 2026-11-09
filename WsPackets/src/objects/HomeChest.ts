import { ItemWithDetails } from "./ItemWithDetails";
import { PlantId } from "./PlantId";

export const CHEST_ACTIONS = {
	DEPOSIT: "deposit", WITHDRAW: "withdraw", SWAP: "swap"
} as const;
export type ChestAction = typeof CHEST_ACTIONS[keyof typeof CHEST_ACTIONS];
export const CHEST_ERRORS = {
	INVALID: "invalid", CHEST_FULL: "chestFull", INVENTORY_FULL: "inventoryFull"
} as const;
export type ChestError = typeof CHEST_ERRORS[keyof typeof CHEST_ERRORS];
export const PLANT_TRANSFER_ACTIONS = {
	DEPOSIT: "plantDeposit", WITHDRAW: "plantWithdraw"
} as const;
export type PlantTransferAction = typeof PLANT_TRANSFER_ACTIONS[keyof typeof PLANT_TRANSFER_ACTIONS];
export const PLANT_TRANSFER_ERRORS = {
	INVALID: "invalid", STORAGE_FULL: "storageFull", NO_EMPTY_SLOT: "noEmptySlot", NOT_FOUND: "notFound"
} as const;
export type PlantTransferError = typeof PLANT_TRANSFER_ERRORS[keyof typeof PLANT_TRANSFER_ERRORS];
export type HomeItemSlot = {
	slot: number; category: number; details: ItemWithDetails;
};
export type ChestCapacity = {
	weapon: number; armor: number; potion: number; object: number;
};
export type PlantStorageEntry = {
	plantId: PlantId; quantity: number; maxCapacity: number;
};
export type PlayerPlantSlot = {
	slot: number; plantId: PlantId | 0;
};
export type HomeChestData = {
	chestItems: HomeItemSlot[];
	depositableItems: HomeItemSlot[];
	slotsPerCategory: ChestCapacity;
	inventoryCapacity: ChestCapacity;
	plantStorage?: PlantStorageEntry[];
	playerPlantSlots?: PlayerPlantSlot[];
	plantMaxCapacity?: number;
};
