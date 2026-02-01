import { Random } from "random-js";
import { ConstantRange } from "../constants/Constants";

/**
 * Functions concerning pseudo-randomness
 */
export abstract class RandomUtils {
	/**
	 * Redefining the random js library
	 */
	public static crowniclesRandom: Random = new Random();

	/**
	 * Generates a random number between min included and max excluded
	 * @param min
	 * @param max
	 * @returns a random number between min included and max excluded
	 */
	public static randInt = (min: number, max: number): number => RandomUtils.crowniclesRandom.integer(min, max - 1);

	/**
	 * Generates a random number in the range (both interval bounds included)
	 * @param range - typically something in constants as {MIN: number, MAX: number}
	 * @param minAdd - Amount to add to range.MIN ; Default : 0
	 * @param maxAdd - Amount to add to range.MAX ; Default : 0
	 * @returns a random number in [MIN, MAX]
	 */
	public static rangedInt = (range: ConstantRange, minAdd = 0, maxAdd = 0): number =>
		RandomUtils.crowniclesRandom.integer(range.MIN + minAdd, range.MAX + maxAdd);

	/**
	 * Generates a random number between -variation and variation
	 * @param variation
	 * @returns a random number in [-variation, variation]
	 */
	public static variationInt = (variation: number): number =>
		RandomUtils.crowniclesRandom.integer(-variation, variation);

	/**
	 * Pick a random element from an enum
	 * @param anEnum - The enum to pick from
	 */
	public static enumPick = <T extends object>(anEnum: T): T[keyof T] => {
		const enumValues = (Object.keys(anEnum)
			.map(n => Number.parseInt(n, 10))
			.filter(n => !Number.isNaN(n)) as unknown) as T[keyof T][];
		const randomIndex = RandomUtils.randInt(0, enumValues.length);
		return enumValues[randomIndex];
	};
}
