import {
	describe, expect, it, vi
} from "vitest";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { FightActionController } from "../../../../src/core/fights/actions/FightActionController";
import type { Fighter } from "../../../../src/core/fights/fighter/Fighter";

vi.spyOn(RandomUtils, "variationInt").mockReturnValue(0);

function buildFighter(level: number): Fighter {
	return { level } as Fighter;
}

describe("FightActionController.getAttackDamage", () => {
	const statsInfo = {
		attackerStats: [100], defenderStats: [100], statsEffect: [1]
	};
	const attackInfo = {
		minDamage: 10, averageDamage: 50, maxDamage: 100
	};

	it("applies the level bonus of the fighter passed as attacker, not any other fighter", () => {
		const lowLevelFighter = buildFighter(1);
		const highLevelFighter = buildFighter(100);

		const damageWithLowLevelAttacker = FightActionController.getAttackDamage(statsInfo, lowLevelFighter, attackInfo, true);
		const damageWithHighLevelAttacker = FightActionController.getAttackDamage(statsInfo, highLevelFighter, attackInfo, true);

		// A higher attacker level must yield a strictly higher level bonus (regression test for #4401:
		// alteration damage was previously computed using the victim's level instead of the original attacker's)
		expect(damageWithHighLevelAttacker).toBeGreaterThan(damageWithLowLevelAttacker);
	});
});
