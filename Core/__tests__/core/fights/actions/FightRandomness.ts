import { vi } from "vitest";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

export type FightRolls = {

	// Percentage drawn by the critical hit / failure check: below the critical probability is a critical hit, then the failure probability is a miss
	secondaryEffectRoll?: number;

	// Value returned by Math.random (the actions draw their side effects with "Math.random() < probability")
	mathRandom?: number;

	// Value returned by RandomUtils.crowniclesRandom.bool, or the value to return for each probability it is called with
	bool?: boolean | ((probability?: number) => boolean);
};

// Percentage roll landing after every critical hit and failure probability: the attack is a normal hit
export const NORMAL_HIT_ROLL = 99;

/**
 * Remove every random part of a fight action: no damage variation, the first failure divider and the given rolls
 * (by default a normal hit and no random side effect)
 * @param rolls
 */
export function fixFightRandomness(rolls: FightRolls = {}): void {
	vi.spyOn(RandomUtils, "variationInt").mockReturnValue(0);
	vi.spyOn(RandomUtils, "randInt").mockReturnValue(rolls.secondaryEffectRoll ?? NORMAL_HIT_ROLL);
	vi.spyOn(Math, "random").mockReturnValue(rolls.mathRandom ?? 0.999);
	vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(<T>(values: ArrayLike<T>): T => values[0]);
	const bool = rolls.bool ?? false;
	vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockImplementation(typeof bool === "boolean" ? (): boolean => bool : bool);
}
