import {
	describe, expect, it
} from "vitest";
import unstoppable from "../../../../../src/core/fights/actions/interfaces/pets/unstoppable";
import { FightAlterations } from "../../../../../src/core/fights/actions/FightAlterations";
import {
	PetAssistanceResult, PetAssistanceState
} from "../../../../../../Lib/src/types/PetAssistanceResult";
import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";
import type { FightController } from "../../../../../src/core/fights/FightController";
import type { FightAlteration } from "../../../../../src/data/FightAlteration";
import type { Fighter } from "../../../../../src/core/fights/fighter/Fighter";
import { buildPetFighter } from "./PetFighterMocks";

/**
 * Play the start of an owner's turn like the fight controller does: pet first, then the counters are reduced before the action
 */
async function startOwnerTurn(owner: Fighter): Promise<PetAssistanceResult | null> {
	const result = await unstoppable(owner, buildPetFighter(), 1, {} as FightController);
	owner.reduceCounters();
	return result;
}

describe("unstoppable pet assistance (mammoth)", () => {
	it("builds momentum by 4% per turn up to +16% damage, then keeps it silently", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.MAMMOTH });
		const expectedStatuses = [
			PetAssistanceState.GENERAL_EFFECT,
			PetAssistanceState.GENERAL_EFFECT,
			PetAssistanceState.GENERAL_EFFECT,
			PetAssistanceState.SUCCESS,
			undefined,
			undefined
		];

		for (let turn = 1; turn <= expectedStatuses.length; turn++) {
			const result = await startOwnerTurn(owner);

			expect(result?.assistanceStatus).toBe(expectedStatuses[turn - 1]);
			expect(owner.getDamageMultiplier()).toBeCloseTo(1 + Math.min(turn, 4) * 0.04);
		}
	});

	it("loses all its momentum when the owner gets stunned, and starts over on the turn the stun wears off", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.MAMMOTH });
		await startOwnerTurn(owner);
		await startOwnerTurn(owner);
		await startOwnerTurn(owner);

		// The stun was just inflicted: it has not affected the owner yet
		owner.alteration = { id: FightAlterations.STUNNED } as FightAlteration;
		owner.alterationTurn = 0;
		const brokenResult = await startOwnerTurn(owner);

		expect(brokenResult?.assistanceStatus).toBe(PetAssistanceState.FAILURE);
		expect(owner.getDamageMultiplier()).toBe(1);

		// On the owner's next turn, the stun is still there when the pet acts but wears off before the owner's action
		owner.alterationTurn = 1;
		const restartResult = await startOwnerTurn(owner);

		expect(restartResult?.assistanceStatus).toBe(PetAssistanceState.GENERAL_EFFECT);
		expect(owner.getDamageMultiplier()).toBeCloseTo(1.04);
	});

	it("stays silent when the owner is immobilized before gaining any momentum", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.MAMMOTH });
		owner.alteration = { id: FightAlterations.PETRIFIED } as FightAlteration;

		expect(await startOwnerTurn(owner)).toBeNull();
		expect(owner.getDamageMultiplier()).toBe(1);
	});

	it("keeps its momentum through alterations that do not immobilize", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.MAMMOTH });
		await startOwnerTurn(owner);
		owner.alteration = { id: FightAlterations.POISONED } as FightAlteration;

		await startOwnerTurn(owner);

		expect(owner.getDamageMultiplier()).toBeCloseTo(1.08);
	});
});
