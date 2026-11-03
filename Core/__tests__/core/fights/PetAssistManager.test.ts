import {
	beforeAll, describe, expect, it
} from "vitest";
import {
	getPetBehaviors, initializeAllPetBehaviors
} from "../../../src/core/fights/PetAssistManager";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";

describe("PetAssistManager", () => {
	beforeAll(() => {
		initializeAllPetBehaviors();
	});

	it.each([
		[PetConstants.PETS.MAMMOTH, [FightConstants.FIGHT_ACTIONS.PET.PROTECT_AGAINST_COLD, FightConstants.FIGHT_ACTIONS.PET.UNSTOPPABLE]],
		[PetConstants.PETS.POLAR_BEAR, [FightConstants.FIGHT_ACTIONS.PET.PROTECT_AGAINST_COLD, FightConstants.FIGHT_ACTIONS.PET.BREATHING_HOLE_AMBUSH]],
		[PetConstants.PETS.EAGLE, [FightConstants.FIGHT_ACTIONS.PET.UN_BLIND, FightConstants.FIGHT_ACTIONS.PET.WOUNDED_PREY]],
		[PetConstants.PETS.SHARK, [FightConstants.FIGHT_ACTIONS.PET.SCARE_FISH, FightConstants.FIGHT_ACTIONS.PET.SCENT_OF_BLOOD]]
	])("gives pet %i its first power, then its second one", (petId, expectedPowers) => {
		expect(getPetBehaviors(petId).map(behavior => behavior.id)).toEqual(expectedPowers);
	});

	it("keeps a single power for the other pets", () => {
		expect(getPetBehaviors(PetConstants.PETS.TIGER).map(behavior => behavior.id)).toEqual([FightConstants.FIGHT_ACTIONS.PET.CLAWS]);
	});

	it("does not register the powers twice when initialized again", () => {
		initializeAllPetBehaviors();

		expect(getPetBehaviors(PetConstants.PETS.MAMMOTH)).toHaveLength(2);
	});

	it("returns no power for an unknown pet", () => {
		expect(getPetBehaviors(-1)).toEqual([]);
	});
});
