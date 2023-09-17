import {Random} from "random-js";
import {ConstantRange} from "../Constants";

/**
 * Functions concerning pseudo-randomness
 */
export class RandomUtils {
	/**
	 * Redefining the random js library
	 */
	public static draftbotRandom: Random = new Random();

	/**
	 * Generates a random number between min included and max excluded
	 * @param min
	 * @param max
	 * @returns a random number between min included and max excluded
	 */
	public static randInt = (min: number, max: number): number => RandomUtils.draftbotRandom.integer(min, max - 1);

	/**
	 * Generates a random number in the range (both interval bounds included)
	 * @param range - typically something in constants as {MIN: number, MAX: number}
	 * @param minAdd - Amount to add to range.MIN ; Default : 1
	 * @param maxAdd - Amount to add to range.MAX ; Default : 1
	 * @returns a random number in [MIN, MAX]
	 */
	public static rangedInt = (range: ConstantRange, minAdd = 0, maxAdd = 1): number =>
		RandomUtils.draftbotRandom.integer(range.MIN + minAdd, range.MAX + maxAdd);

	/**
	 * Generates a random number between -variation and variation
	 * @param variation
	 * @returns a random number in [-variation, variation]
	 */
	public static variationInt = (variation: number): number =>
		RandomUtils.draftbotRandom.integer(-variation, variation);
}