import { IMission } from "../IMission";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

/**
 * Maps each city NPC shop to a mission variant.
 * Keys mirror the city shop ids; values are used both as mission variants and
 * as translation keys (models:cityNpcNames).
 */
export const CITY_NPC_VARIANTS = {
	royalMarket: 1,
	generalShop: 2,
	stockExchange: 3,
	tanner: 4,
	herbalist: 5,
	lumberjack: 6,
	veterinarian: 7,
	materialMerchant: 8
} as const;

export type CityNpcVariant = typeof CITY_NPC_VARIANTS[keyof typeof CITY_NPC_VARIANTS];

const ALL_VARIANTS: CityNpcVariant[] = Object.values(CITY_NPC_VARIANTS);

export const missionInterface: IMission = {
	generateRandomVariant: () => RandomUtils.crowniclesRandom.pick(ALL_VARIANTS),

	areParamsMatchingVariantAndBlob: (variant, params) => (params.npc as number) === variant,

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
