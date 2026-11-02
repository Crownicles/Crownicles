import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import woundedPrey from "../../../../../src/core/fights/actions/interfaces/pets/woundedPrey";
import { PetAssistanceState } from "../../../../../../Lib/src/types/PetAssistanceResult";
import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import type { FightController } from "../../../../../src/core/fights/FightController";
import { buildPetFighter } from "./PetFighterMocks";

const FIGHT = {} as FightController;
const MAX_ENERGY = 1700;

describe("woundedPrey pet assistance (eagle)", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(RandomUtils, "variationInt").mockReturnValue(0);
	});

	it("does not dive while the opponent has 15% of its energy or more", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.EAGLE });

		expect(await woundedPrey(owner, buildPetFighter({ energy: MAX_ENERGY }), 3, FIGHT)).toBeNull();
		expect(await woundedPrey(owner, buildPetFighter({ energy: MAX_ENERGY * 0.15 }), 3, FIGHT)).toBeNull();
	});

	it("dives only once on a prey under 15% of its energy", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.EAGLE });
		const opponent = buildPetFighter({ energy: MAX_ENERGY * 0.15 - 1 });

		const dive = await woundedPrey(owner, opponent, 9, FIGHT);

		expect(dive?.assistanceStatus).toBe(PetAssistanceState.SUCCESS);
		expect(dive?.damages).toBeGreaterThan(0);
		expect(await woundedPrey(owner, opponent, 11, FIGHT)).toBeNull();
	});

	it("hits as hard as a finishing blow on a level 100 prey despite the eagle's low force", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.EAGLE });
		const opponent = buildPetFighter({
			energy: 200,
			speed: 600
		});

		const dive = await woundedPrey(owner, opponent, 9, FIGHT);

		expect(dive?.damages).toBeGreaterThan(MAX_ENERGY * 0.1);
		expect(dive?.damages).toBeLessThan(MAX_ENERGY * 0.2);
	});
});
