import { GardenEarthQuality } from "../types/GardenEarthQuality";
import { TimeConstants } from "./TimeConstants";

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
		PLANT: "plant",
		WATER: "water"
	} as const;

	public static readonly GARDEN_ERRORS = {
		NO_READY_PLANTS: "noReadyPlants",
		NO_SEED: "noSeed",
		NO_EMPTY_PLOT: "noEmptyPlot",
		SEED_ALREADY_PLANTED: "seedAlreadyPlanted",
		WATERING_ON_COOLDOWN: "wateringOnCooldown",
		NO_PLANTS_TO_WATER: "noPlantsToWater"
	} as const;

	/**
	 * Plant quantities the player can compost at once in the manual-compost flow.
	 * The "5" button is hidden when storage holds fewer than 5 plants of the selected type.
	 */
	public static readonly COMPOST_QUANTITIES = [1, 5] as const;

	/**
	 * Cooldown (in ms) between two waterings of the player's garden.
	 */
	public static readonly WATERING_COOLDOWN_MS = 12 * TimeConstants.MS_TIME.HOUR;

	/**
	 * Price in coins of the "Cœur Sylvestre" talisman that unlocks remote garden harvest.
	 */
	public static readonly REMOTE_HARVEST_TALISMAN_PRICE = 2_450;

	/**
	 * Get the effective growth time in seconds for a plant given an earth quality
	 */
	public static getEffectiveGrowthTime(baseGrowthTimeSeconds: number, earthQuality: GardenEarthQuality): number {
		return Math.ceil(baseGrowthTimeSeconds * GardenConstants.EARTH_QUALITY_MULTIPLIER[earthQuality]);
	}
}
