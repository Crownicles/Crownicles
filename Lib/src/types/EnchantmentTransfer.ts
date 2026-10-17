import { MainItemDetails } from "./MainItemDetails";
import { DisenchantableItem } from "./DisenchantableItem";

/**
 * An unenchanted equipment of the same category that can receive the enchantment of a transfer source
 */
export type EnchantmentTransferTarget = {
	slot: number;
	details: MainItemDetails;

	/** Gold cost of the transfer, depending on the rarity of this equipment */
	cost: number;

	/** Core-authoritative eligibility: the player has enough gold for this transfer */
	canAfford: boolean;
};

/**
 * An enchanted equipment whose enchantment the blacksmith can move onto one of the listed targets
 */
export type EnchantmentTransferSource = DisenchantableItem & {
	targets: EnchantmentTransferTarget[];
};
