import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { FightActionController } from "../../../../../src/core/fights/actions/FightActionController";
import sabotageAttackUse from "../../../../../src/core/fights/actions/interfaces/players/sabotageAttack";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { FightAlterations } from "../../../../../src/core/fights/actions/FightAlterations";
import { TestFighter } from "./TestFighter";
import type { FightAction } from "../../../../../src/data/FightAction";
import type { FightController } from "../../../../../src/core/fights/FightController";

const SABOTAGE_ATTACK = { id: FightConstants.FIGHT_ACTIONS.PLAYER.SABOTAGE_ATTACK } as FightAction;
const COMPUTED_DAMAGE = 80;

/**
 * Launch a sabotage attack whose paralysis roll gives the given value
 */
function sabotage(paralysisRoll: number): {
	result: ReturnType<typeof sabotageAttackUse>; sender: TestFighter;
} {
	vi.spyOn(Math, "random").mockReturnValue(paralysisRoll);
	vi.spyOn(FightActionController, "applySecondaryEffects").mockReturnValue({
		status: "normal", damages: COMPUTED_DAMAGE
	} as ReturnType<typeof FightActionController.applySecondaryEffects>);
	const sender = new TestFighter();
	const result = sabotageAttackUse(sender, new TestFighter(), SABOTAGE_ATTACK, 3, null as unknown as FightController);
	return {
		result, sender
	};
}

describe("sabotageAttack", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("paralyzes its sender and deals more damage when the paralysis roll succeeds", () => {
		const { result, sender } = sabotage(FightConstants.SABOTAGE_SELF_PARALYSIS_CHANCE - 0.01);

		expect(sender.alteration?.id).toBe(FightAlterations.PARALYZED);
		expect(result.damages).toBe(COMPUTED_DAMAGE * 1.5);
	});

	it("leaves its sender free to act when the paralysis roll fails", () => {
		const { result, sender } = sabotage(FightConstants.SABOTAGE_SELF_PARALYSIS_CHANCE);

		expect(sender.hasFightAlteration()).toBe(false);
		expect(result.damages).toBe(COMPUTED_DAMAGE);
	});
});
