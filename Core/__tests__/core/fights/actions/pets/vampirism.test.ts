import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import vampirism from "../../../../../src/core/fights/actions/interfaces/pets/vampirism";
import { PetAssistanceState } from "../../../../../../Lib/src/types/PetAssistanceResult";
import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import type { FightController } from "../../../../../src/core/fights/FightController";
import { buildPetFighter } from "./PetFighterMocks";

const OWNER_ENERGY = 1000;

describe("vampirism pet assistance (bat)", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(RandomUtils, "variationInt").mockReturnValue(0);
	});

	it("bites the opponent and gives its owner half of the drained energy", async () => {
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
		const owner = buildPetFighter({
			petTypeId: PetConstants.PETS.BAT,
			energy: OWNER_ENERGY
		});

		const result = await vampirism(owner, buildPetFighter(), 1, {} as FightController);

		expect(result?.assistanceStatus).toBe(PetAssistanceState.SUCCESS);
		expect(result!.damages).toBeGreaterThan(1);
		expect(owner.getEnergy()).toBe(OWNER_ENERGY + Math.round(result!.damages! / 2));
	});
});
