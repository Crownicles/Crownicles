import { IMission } from "../IMission";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

/**
 * Encodes the way materials can be collected for the collectMaterialsByMethod mission.
 * Values are used both as mission variants and as translation keys (materialMethodNames).
 */
export const MATERIAL_COLLECT_METHOD = {
	COMPOST: 1,
	BOSS: 2
} as const;

export type MaterialCollectMethod = typeof MATERIAL_COLLECT_METHOD[keyof typeof MATERIAL_COLLECT_METHOD];

const ALL_METHODS: MaterialCollectMethod[] = Object.values(MATERIAL_COLLECT_METHOD);

export const missionInterface: IMission = {
	generateRandomVariant: () => ALL_METHODS[RandomUtils.crowniclesRandom.integer(0, ALL_METHODS.length - 1)],

	areParamsMatchingVariantAndBlob: (variant, params) => (params.method as number) === variant,

	initialNumberDone: () => 0,

	updateSaveBlob: () => null
};
