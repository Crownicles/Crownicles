import {
	afterAll, beforeAll, describe, expect, it, vi
} from "vitest";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { FightActionController } from "../../../../src/core/fights/actions/FightActionController";
import type { Fighter } from "../../../../src/core/fights/fighter/Fighter";
import { FightAlterationDataController } from "../../../../src/data/FightAlteration";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import {
	defaultFightActionResult, FightStatBuffed
} from "../../../../../Lib/src/types/FightActionResult";
import { FightStatModifierOperation } from "../../../../../Lib/src/types/FightStatModifierOperation";
import { TestFighter } from "./players/TestFighter";

function buildFighter(level: number): Fighter {
	return { level } as Fighter;
}

describe("FightActionController.getAttackDamage", () => {
	let variationIntSpy: ReturnType<typeof vi.spyOn>;

	beforeAll(() => {
		variationIntSpy = vi.spyOn(RandomUtils, "variationInt").mockReturnValue(0);
	});

	afterAll(() => {
		variationIntSpy.mockRestore();
	});

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

describe("FightActionController.applyBuff", () => {
	function healFighter(alterationId: string | null): {
		healed: number; recorded: number;
	} {
		const fighter = new TestFighter({ energy: 500 });
		if (alterationId) {
			fighter.newAlteration(FightAlterationDataController.instance.getById(alterationId)!);
		}
		const result = defaultFightActionResult();
		FightActionController.applyBuff(result, {
			selfTarget: true,
			stat: FightStatBuffed.ENERGY,
			operator: FightStatModifierOperation.ADDITION,
			value: 100
		}, fighter, null);
		return {
			healed: fighter.getEnergy() - 500,
			recorded: result.buffs![0].value
		};
	}

	it("reduces the healing of a cursed fighter and records the energy it actually gains", () => {
		expect(healFighter(FightConstants.FIGHT_ACTIONS.ALTERATION.CURSED)).toEqual({
			healed: 60, recorded: 60
		});
	});

	it("leaves the healing of a fighter with another alteration untouched", () => {
		expect(healFighter(FightConstants.FIGHT_ACTIONS.ALTERATION.POISONED)).toEqual({
			healed: 100, recorded: 100
		});
	});
});
