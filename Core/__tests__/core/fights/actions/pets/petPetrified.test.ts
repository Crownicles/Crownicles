import {
	describe, expect, it
} from "vitest";
import petPetrified from "../../../../../src/core/fights/actions/interfaces/pets/petPetrified";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../Lib/src/types/PetAssistanceResult";
import { FightAlterations } from "../../../../../src/core/fights/actions/FightAlterations";
import { FightAlterationDataController } from "../../../../../src/data/FightAlteration";
import type { FightController } from "../../../../../src/core/fights/FightController";
import type { PlayerFighter } from "../../../../../src/core/fights/fighter/PlayerFighter";
import { buildPetFighter } from "./PetFighterMocks";

function usePet(turn: number, opponent: PlayerFighter): Promise<PetAssistanceResult | null> {
	return petPetrified(buildPetFighter(), opponent, turn, {} as FightController);
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
		const opponent = buildPetFighter();

		const result = await usePet(turn, opponent);

		expect(result?.assistanceStatus).toBe(PetAssistanceState.SUCCESS);
		expect(result?.alterations?.[0].alteration).toBe(FightAlterations.PETRIFIED);
		expect(opponent.alteration?.id).toBe(FightAlterations.PETRIFIED);
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
		const opponent = buildPetFighter();

		expect(await usePet(turn, opponent)).toBeNull();
		expect(opponent.hasFightAlteration()).toBe(false);
	});

	it("does nothing when the opponent is already altered", async () => {
		const opponent = buildPetFighter();
		opponent.newAlteration(FightAlterationDataController.instance.getById(FightAlterations.POISONED)!);

		expect(await usePet(14, opponent)).toBeNull();
		expect(opponent.alteration?.id).toBe(FightAlterations.POISONED);
	});
});
