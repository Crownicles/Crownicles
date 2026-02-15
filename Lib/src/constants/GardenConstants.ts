import { GardenEarthQuality } from "../types/GardenEarthQuality";

export abstract class GardenConstants {
	/**
	 * Growth time multiplier per earth quality.
	 * Lower value = faster growth.
	 * POOR = base speed, AVERAGE = 25% faster, RICH = 50% faster
	 */
	public static readonly EARTH_QUALITY_MULTIPLIER: Record<GardenEarthQuality, number> = {
		[GardenEarthQuality.POOR]: 1.0,
		[GardenEarthQuality.AVERAGE]: 0.75,
		[GardenEarthQuality.RICH]: 0.5
	};

	public static readonly GARDEN_ACTIONS = {
		HARVEST: "harvest",
		PLANT: "plant"
	} as const;

	public static readonly GARDEN_ERRORS = {
		NO_READY_PLANTS: "noReadyPlants",
		NO_SEED: "noSeed",
		NO_EMPTY_PLOT: "noEmptyPlot",
		SEED_ALREADY_PLANTED: "seedAlreadyPlanted"
	} as const;

	/**
	 * Get the effective growth time in seconds for a plant given an earth quality
	 */
	public static getEffectiveGrowthTime(baseGrowthTimeSeconds: number, earthQuality: GardenEarthQuality): number {
		return Math.ceil(baseGrowthTimeSeconds * GardenConstants.EARTH_QUALITY_MULTIPLIER[earthQuality]);
	}
}
