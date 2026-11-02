import {
	describe, expect, it, vi
} from "vitest";
import petPetrified from "../../../../../src/core/fights/actions/interfaces/pets/petPetrified";
import { PetAssistanceState } from "../../../../../../Lib/src/types/PetAssistanceResult";
import { FightAlterations } from "../../../../../src/core/fights/actions/FightAlterations";
import type { FightController } from "../../../../../src/core/fights/FightController";
import type { Fighter } from "../../../../../src/core/fights/fighter/Fighter";
import type { FightAlteration } from "../../../../../src/data/FightAlteration";

function buildOpponent(hasAlteration = false): Fighter {
	return {
		hasFightAlteration: (): boolean => hasAlteration,
		newAlteration: vi.fn((alteration: FightAlteration) => alteration)
	} as unknown as Fighter;
}

function usePet(turn: number, opponent: Fighter): ReturnType<typeof petPetrified> {
	return petPetrified({} as Fighter, opponent, turn, {} as FightController);
}

describe("petPetrified pet assistance (#5063)", () => {
	it.each([
		2,
		3,
		14,
		15,
		28,
		29,
		40,
		41
	])("petrifies the opponent on turn %i", async turn => {
		const opponent = buildOpponent();

		const result = await usePet(turn, opponent);

		expect(result?.assistanceStatus).toBe(PetAssistanceState.SUCCESS);
		expect(result?.alterations?.[0].alteration).toBe(FightAlterations.PETRIFIED);
		expect(opponent.newAlteration).toHaveBeenCalledOnce();
	});

	it.each([
		1,
		4,
		8,
		13,
		16,
		26,
		27,
		30
	])("does nothing on turn %i", async turn => {
		const opponent = buildOpponent();

		expect(await usePet(turn, opponent)).toBeNull();
		expect(opponent.newAlteration).not.toHaveBeenCalled();
	});

	it("does nothing when the opponent is already altered", async () => {
		const opponent = buildOpponent(true);

		expect(await usePet(14, opponent)).toBeNull();
		expect(opponent.newAlteration).not.toHaveBeenCalled();
	});
});
