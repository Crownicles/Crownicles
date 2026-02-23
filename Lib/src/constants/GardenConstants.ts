import { GardenEarthQuality } from "../types/GardenEarthQuality";

export abstract class GardenConstants {
	/**
	 * Growth time multiplier per earth quality.
	 * Higher value = slower growth.
	 * RICH = base speed, AVERAGE = 50% slower, POOR = 100% slower (x2 duration)
	 */
	public static readonly EARTH_QUALITY_MULTIPLIER: Record<GardenEarthQuality, number> = {
		[GardenEarthQuality.POOR]: 2.0,
		[GardenEarthQuality.AVERAGE]: 1.5,
		[GardenEarthQuality.RICH]: 1.0
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
