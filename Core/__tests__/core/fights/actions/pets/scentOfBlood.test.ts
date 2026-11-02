import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import scentOfBlood from "../../../../../src/core/fights/actions/interfaces/pets/scentOfBlood";
import { FightAlterations } from "../../../../../src/core/fights/actions/FightAlterations";
import { FightAlterationDataController } from "../../../../../src/data/FightAlteration";
import { PetAssistanceState } from "../../../../../../Lib/src/types/PetAssistanceResult";
import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import type { FightController } from "../../../../../src/core/fights/FightController";
import type { PlayerFighter } from "../../../../../src/core/fights/fighter/PlayerFighter";
import { buildPetFighter } from "./PetFighterMocks";

const FIGHT = {} as FightController;
const MAX_ENERGY = 1700;

function buildWoundedPrey(): PlayerFighter {
	return buildPetFighter({ energy: MAX_ENERGY / 2 - 1 });
}

describe("scentOfBlood pet assistance (shark)", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(RandomUtils, "variationInt").mockReturnValue(0);
	});

	it("does nothing while the opponent has half of its energy or more", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.SHARK });

		expect(await scentOfBlood(owner, buildPetFighter({ energy: MAX_ENERGY / 2 }), 3, FIGHT)).toBeNull();
	});

	it("waits for the opponent to be free of any other alteration", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.SHARK });
		const opponent = buildWoundedPrey();
		opponent.newAlteration(FightAlterationDataController.instance.getById(FightAlterations.POISONED)!);

		expect(await scentOfBlood(owner, opponent, 3, FIGHT)).toBeNull();
		expect(opponent.alteration?.id).toBe(FightAlterations.POISONED);
	});

	it("bites a wounded opponent and makes it bleed", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.SHARK });
		const opponent = buildWoundedPrey();

		const wound = await scentOfBlood(owner, opponent, 5, FIGHT);

		expect(wound?.assistanceStatus).toBe(PetAssistanceState.GENERAL_EFFECT);
		expect(wound?.damages).toBeGreaterThan(0);
		expect(opponent.alteration?.id).toBe(FightAlterations.BLEEDING);
	});

	it("circles while the prey bleeds, then bites in a frenzy once it bled for the whole bleeding", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.SHARK });
		const opponent = buildWoundedPrey();
		await scentOfBlood(owner, opponent, 5, FIGHT);

		opponent.alterationTurn = 1;
		expect(await scentOfBlood(owner, opponent, 7, FIGHT)).toBeNull();
		opponent.alterationTurn = 2;
		expect(await scentOfBlood(owner, opponent, 9, FIGHT)).toBeNull();
		opponent.alterationTurn = 3;
		const frenzy = await scentOfBlood(owner, opponent, 11, FIGHT);

		expect(frenzy?.assistanceStatus).toBe(PetAssistanceState.SUCCESS);
		expect(frenzy?.damages).toBeGreaterThan(0);
		expect(await scentOfBlood(owner, opponent, 13, FIGHT)).toBeNull();
	});

	it("loses the trail for the rest of the fight when the prey stops its bleeding", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.SHARK });
		const opponent = buildWoundedPrey();
		await scentOfBlood(owner, opponent, 5, FIGHT);

		opponent.removeAlteration();

		expect((await scentOfBlood(owner, opponent, 7, FIGHT))?.assistanceStatus).toBe(PetAssistanceState.FAILURE);
		expect(await scentOfBlood(owner, opponent, 9, FIGHT)).toBeNull();
		expect(opponent.hasFightAlteration()).toBe(false);
	});
});
