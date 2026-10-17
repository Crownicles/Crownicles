import {
	describe, expect, it, vi
} from "vitest";
import petrifiedUse from "../../../../../src/core/fights/actions/interfaces/alterations/petrified";
import { FightActionDataController } from "../../../../../src/data/FightAction";
import { FightAlterationState } from "../../../../../../Lib/src/types/FightAlterationResult";
import type { Fighter } from "../../../../../src/core/fights/fighter/Fighter";
import type { FightAlteration } from "../../../../../src/data/FightAlteration";
import type { FightAction } from "../../../../../src/data/FightAction";
import type { FightController } from "../../../../../src/core/fights/FightController";

const CHOSEN_ACTION = { id: "chosenAttack" } as FightAction;

function buildAffected(alterationTurn: number): Fighter {
	return {
		alterationTurn,
		nextFightAction: CHOSEN_ACTION,
		hasDefenseModifier: (): boolean => true,
		removeDefenseModifiers: vi.fn(),
		removeAlteration: vi.fn()
	} as unknown as Fighter;
}

function usePetrified(affected: Fighter): ReturnType<typeof petrifiedUse> {
	return petrifiedUse(affected, null as unknown as FightAlteration, affected, 1, null as unknown as FightController);
}

describe("petrified alteration", () => {
	it("makes the fighter lose their first turn", () => {
		const affected = buildAffected(1);

		const result = usePetrified(affected);

		expect(result.state).toBe(FightAlterationState.NO_ACTION);
		expect(affected.nextFightAction).toBe(FightActionDataController.instance.getNone());
		expect(affected.removeAlteration).not.toHaveBeenCalled();
	});

	it("wears off on the second turn and lets the fighter act", () => {
		const affected = buildAffected(2);

		const result = usePetrified(affected);

		expect(result.state).toBe(FightAlterationState.STOP);
		expect(affected.nextFightAction).toBe(CHOSEN_ACTION);
		expect(affected.removeDefenseModifiers).toHaveBeenCalled();
		expect(affected.removeAlteration).toHaveBeenCalled();
	});
});
