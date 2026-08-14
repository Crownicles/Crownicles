import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import blindUse from "../../../../../src/core/fights/actions/interfaces/alterations/blind";
import { FightActionDataController } from "../../../../../src/data/FightAction";
import { FightAlterationState } from "../../../../../../Lib/src/types/FightAlterationResult";
import type { Fighter } from "../../../../../src/core/fights/fighter/Fighter";
import type { FightAlteration } from "../../../../../src/data/FightAlteration";
import type { FightAction } from "../../../../../src/data/FightAction";
import type { FightController } from "../../../../../src/core/fights/FightController";

const CHOSEN_ACTION = { id: "chosenAttack" } as FightAction;
const RANDOM_ACTION = { id: "randomAttack" } as FightAction;

function buildAffected(): Fighter {
	// alterationTurn 1 keeps the alteration out of its heal branch, which requires alterationTurn > 1
	return {
		alterationTurn: 1,
		nextFightAction: CHOSEN_ACTION,
		hasDefenseModifier: (): boolean => true,
		hasSpeedModifier: (): boolean => true,
		getRandomAvailableFightAction: (): FightAction => RANDOM_ACTION
	} as unknown as Fighter;
}

function useBlind(affected: Fighter): ReturnType<typeof blindUse> {
	return blindUse(affected, null as unknown as FightAlteration, affected, 1, null as unknown as FightController);
}

/**
 * Regression test for #4639: the "blind" narration announces that the fighter strikes at random, so the
 * alteration must actually replace the action they chose when it does not make them miss their turn.
 */
describe("blind alteration", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("replaces the chosen action by a random one while active", () => {
		// No heal, and no missed turn: only the "strikes at random" branch is left
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
		const affected = buildAffected();

		const result = useBlind(affected);

		expect(result.state).toBe(FightAlterationState.ACTIVE);
		expect(affected.nextFightAction).toBe(RANDOM_ACTION);
	});

	it("makes the fighter do nothing when the alteration steals their turn", () => {
		const none = FightActionDataController.instance.getNone();
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);
		const affected = buildAffected();
		affected.alterationTurn = 1;

		const result = useBlind(affected);

		expect(result.state).toBe(FightAlterationState.NO_ACTION);
		expect(affected.nextFightAction).toBe(none);
	});
});
