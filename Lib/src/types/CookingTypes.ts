import { PlantId } from "../constants/PlantConstants";

export interface CookingSlotData {
	slotIndex: number;
	recipe: {
		id: string;
		level: number;
		isSecret: boolean;
		outputDescription: string;
		ingredients: {
			plants: {
				plantId: PlantId; quantity: number; playerHas: number;
			}[];
			materials: {
				materialId: number; quantity: number; playerHas: number;
			}[];
		};
		canCraft: boolean;
	} | null;
}

export const CookingCraftErrors = {
	CRAFT_UNAVAILABLE: "craftUnavailable",
	INVENTORY_FULL: "inventoryFull",
	GUILD_REQUIRED: "guildRequired",
	GUILD_STORAGE_FULL: "guildStorageFull"
} as const;

export type CookingCraftError = typeof CookingCraftErrors[keyof typeof CookingCraftErrors];
