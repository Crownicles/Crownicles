import { MaterialRarity } from "./MaterialRarity";

/**
 * A batch of materials known by their rarity only. Used for blacksmith pricing, where the
 * exact material does not matter: only its rarity drives the price.
 */
export interface MaterialRarityQuantity {
	rarity: MaterialRarity;
	quantity: number;
}
