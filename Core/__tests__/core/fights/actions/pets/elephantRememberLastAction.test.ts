import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import elephantRememberLastAction from "../../../../../src/core/fights/actions/interfaces/pets/elephantRememberLastAction";
import { PetAssistanceState } from "../../../../../../Lib/src/types/PetAssistanceResult";
import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import { PetEntities } from "../../../../../src/core/database/game/models/PetEntity";
import type { FightController } from "../../../../../src/core/fights/FightController";
import { buildPetFighter } from "./PetFighterMocks";

describe("elephantRememberLastAction pet assistance (#5144)", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
	});

	it("is afraid of the mouse of a king guard, whose player has no pet in database", async () => {
		const kingGuard = buildPetFighter({ petTypeId: PetConstants.PETS.MOUSE });

		const result = await elephantRememberLastAction(buildPetFighter(), kingGuard, 3, {} as FightController);

		expect(result?.assistanceStatus).toBe(PetAssistanceState.AFRAID);
	});

	it("is not afraid of a mouse that does not take part in the fight", async () => {
		vi.spyOn(PetEntities, "getById").mockResolvedValue({ typeId: PetConstants.PETS.MOUSE } as never);

		const result = await elephantRememberLastAction(buildPetFighter(), buildPetFighter(), 3, {} as FightController);

		expect(result?.assistanceStatus).not.toBe(PetAssistanceState.AFRAID);
	});
});
