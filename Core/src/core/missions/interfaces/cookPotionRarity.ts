import { IMission } from "../IMission";

export const missionInterface: IMission = {
	// The mission is satisfied when a cooked potion's rarity reaches the variant threshold.
	areParamsMatchingVariantAndBlob: (variant, params) => (params.rarity as number) >= variant,

	generateRandomVariant: () => 0,

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
