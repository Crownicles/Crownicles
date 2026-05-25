import { PossibilityCondition } from "./PossibilityCondition";
import { PossibilityOutcome } from "./PossibilityOutcome";

/**
 * A big event contains a set of possibilities which have a set of outcomes
 */
export class Possibility {
	/**
	 * Possibility condition
	 */
	public readonly condition?: PossibilityCondition;

	/**
	 * Possibility outcomes
	 */
	public readonly outcomes!: { [key: string]: PossibilityOutcome };

	/**
	 * Possibility tags
	 */
	public readonly tags!: string[];
}

/**
 * Tuple representing a possibility keyed by its id alongside its data.
 * Used everywhere possibilities are passed around `Object.entries`-style.
 */
export type PossibilityEntry = [string, Possibility];
