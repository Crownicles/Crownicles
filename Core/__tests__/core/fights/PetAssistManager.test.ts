import {
	beforeAll, describe, expect, it
} from "vitest";
import {
	getPetBehaviors, initializeAllPetBehaviors
} from "../../../src/core/fights/PetAssistManager";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";

const PET_POWERS = FightConstants.FIGHT_ACTIONS.PET;

describe("PetAssistManager", () => {
	beforeAll(() => {
		initializeAllPetBehaviors();
	});

	it.each([
		[PetConstants.PETS.MAMMOTH, [PET_POWERS.PROTECT_AGAINST_COLD, PET_POWERS.UNSTOPPABLE]],
		[PetConstants.PETS.POLAR_BEAR, [PET_POWERS.PROTECT_AGAINST_COLD, PET_POWERS.BREATHING_HOLE_AMBUSH]],
		[PetConstants.PETS.EAGLE, [PET_POWERS.UN_BLIND, PET_POWERS.WOUNDED_PREY]],
		[PetConstants.PETS.SHARK, [PET_POWERS.SCARE_FISH, PET_POWERS.SCENT_OF_BLOOD]]
	])("gives pet %i its first power, then its second one", (petId, expectedPowers) => {
		expect(getPetBehaviors(petId).map(behavior => behavior.id)).toEqual(expectedPowers);
	});

	it("keeps a single power for the other pets", () => {
		expect(getPetBehaviors(PetConstants.PETS.TIGER).map(behavior => behavior.id)).toEqual([PET_POWERS.CLAWS]);
	});

	it("does not register the powers twice when initialized again", () => {
		initializeAllPetBehaviors();

		expect(getPetBehaviors(PetConstants.PETS.MAMMOTH)).toHaveLength(2);
	});

	it("returns no power for an unknown pet", () => {
		expect(getPetBehaviors(-1)).toEqual([]);
	});
});
