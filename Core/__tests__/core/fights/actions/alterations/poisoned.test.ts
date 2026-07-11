import {
	afterAll, beforeAll, describe, expect, it, vi
} from "vitest";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import poisonedUse from "../../../../../src/core/fights/actions/interfaces/alterations/poisoned";
import type { Fighter } from "../../../../../src/core/fights/fighter/Fighter";
import type { FightAlteration } from "../../../../../src/data/FightAlteration";
import type { FightController } from "../../../../../src/core/fights/FightController";

const ATTACK = 50;

function buildAffected(): Fighter {
	// alterationTurn 1 keeps the alteration in its damage branch (the heal branch requires alterationTurn > 3).
	// A fixed level ensures that, if damage were (wrongly) scaled by the victim, both scenarios would be equal.
	return {
		level: 1, alterationTurn: 1
	} as Fighter;
}

function buildOpponent(level: number): Fighter {
	return {
		level,
		getAttack: () => ATTACK,
		getAlterationMultiplier: () => 1
	} as unknown as Fighter;
}

/**
 * Regression test for #4401: the alteration damage must scale with the level of the fighter who
 * inflicted the alteration (opponent), not the victim (affected). This guards the call-site wiring
 * that passes `opponent` to defaultDamageFightAlterationResult.
 */
describe("poisoned alteration wiring", () => {
	let variationIntSpy: ReturnType<typeof vi.spyOn>;

	beforeAll(() => {
		variationIntSpy = vi.spyOn(RandomUtils, "variationInt").mockReturnValue(0);
	});

	afterAll(() => {
		variationIntSpy.mockRestore();
	});

	it("scales poison damage with the inflicting opponent's level, not the victim's", () => {
		const affected = buildAffected();
		const noArgs = null as unknown as FightAlteration;
		const fight = null as unknown as FightController;

		const lowLevelOpponentDamage = poisonedUse(affected, noArgs, buildOpponent(1), 1, fight).damages;
		const highLevelOpponentDamage = poisonedUse(affected, noArgs, buildOpponent(100), 1, fight).damages;

		expect(lowLevelOpponentDamage).toBeGreaterThan(0);
		expect(highLevelOpponentDamage).toBeGreaterThan(lowLevelOpponentDamage!);
	});
});
