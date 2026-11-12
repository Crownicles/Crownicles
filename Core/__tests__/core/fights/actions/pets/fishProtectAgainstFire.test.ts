import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import fishProtectAgainstFire from "../../../../../src/core/fights/actions/interfaces/pets/fishProtectAgainstFire";
import { PetAssistanceState } from "../../../../../../Lib/src/types/PetAssistanceResult";
import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";
import { FightAlterations } from "../../../../../src/core/fights/actions/FightAlterations";
import { FightAlterationDataController } from "../../../../../src/data/FightAlteration";
import { PetEntities } from "../../../../../src/core/database/game/models/PetEntity";
import type { FightController } from "../../../../../src/core/fights/FightController";
import type { PlayerFighter } from "../../../../../src/core/fights/fighter/PlayerFighter";
import { buildPetFighter } from "./PetFighterMocks";

function buildBurnedFighter(): PlayerFighter {
	const fighter = buildPetFighter();
	fighter.newAlteration(FightAlterationDataController.instance.getById(FightAlterations.BURNED)!);
	return fighter;
}

describe("fishProtectAgainstFire pet assistance (#5144)", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("is afraid of the shark of a king guard, whose player has no pet in database", async () => {
		const fighter = buildBurnedFighter();
		const kingGuard = buildPetFighter({ petTypeId: PetConstants.PETS.SHARK });

		const result = await fishProtectAgainstFire(fighter, kingGuard, 3, {} as FightController);

		expect(result?.assistanceStatus).toBe(PetAssistanceState.AFRAID);
		expect(fighter.alteration?.id).toBe(FightAlterations.BURNED);
	});

	it("is not afraid of a shark that does not take part in the fight", async () => {
		vi.spyOn(PetEntities, "getById").mockResolvedValue({ typeId: PetConstants.PETS.SHARK } as never);
		const fighter = buildBurnedFighter();

		const result = await fishProtectAgainstFire(fighter, buildPetFighter(), 3, {} as FightController);

		expect(result?.assistanceStatus).toBe(PetAssistanceState.SUCCESS);
		expect(fighter.hasFightAlteration()).toBe(false);
	});
});
