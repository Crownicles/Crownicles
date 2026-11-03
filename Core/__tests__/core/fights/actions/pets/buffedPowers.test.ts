import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import horn from "../../../../../src/core/fights/actions/interfaces/pets/horn";
import crush from "../../../../../src/core/fights/actions/interfaces/pets/crush";
import createBomb from "../../../../../src/core/fights/actions/interfaces/pets/createBomb";
import petHit from "../../../../../src/core/fights/actions/interfaces/pets/petHit";
import { PetAssistanceState } from "../../../../../../Lib/src/types/PetAssistanceResult";
import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import { FightActionDataController } from "../../../../../src/data/FightAction";
import type { FightController } from "../../../../../src/core/fights/FightController";
import type { PlayerFighter } from "../../../../../src/core/fights/fighter/PlayerFighter";
import { buildPetFighter } from "./PetFighterMocks";

const FIGHT = {} as FightController;

async function statusesOnTurns(power: typeof horn, owner: PlayerFighter, opponent: PlayerFighter, turns: number[]): Promise<(string | undefined)[]> {
	const statuses: (string | undefined)[] = [];
	for (const turn of turns) {
		statuses.push((await power(owner, opponent, turn, FIGHT))?.assistanceStatus);
	}
	return statuses;
}

describe("buffed pet powers (#5063)", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(RandomUtils, "variationInt").mockReturnValue(0);
	});

	it("horn: the pet takes a run-up then strikes twice per fight", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.RHINO });

		const statuses = await statusesOnTurns(horn, owner, buildPetFighter(), [1, 3, 5, 12, 13, 15, 17]);

		expect(statuses).toEqual([
			PetAssistanceState.GENERAL_EFFECT,
			PetAssistanceState.SUCCESS,
			undefined,
			undefined,
			PetAssistanceState.GENERAL_EFFECT,
			PetAssistanceState.SUCCESS,
			undefined
		]);
	});

	it("crush: the pet wobbles on turn 9/10 and falls on a slow opponent on turn 11/12", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.DINOSAUR });
		const slowOpponent = buildPetFighter({ speed: 100 });

		const statuses = await statusesOnTurns(crush, owner, slowOpponent, [8, 9, 11, 13, 15]);

		expect(statuses).toEqual([
			undefined,
			PetAssistanceState.GENERAL_EFFECT,
			PetAssistanceState.SUCCESS,
			undefined,
			undefined
		]);
	});

	it("createBomb: the bomb explodes mid-fight when its owner is not ahead", async () => {
		const owner = buildPetFighter({
			petTypeId: PetConstants.PETS.SCARLET_DUCK,
			energy: 800
		});

		const statuses = await statusesOnTurns(createBomb, owner, buildPetFighter({ energy: 900 }), [12, 13, 23]);

		expect(statuses).toEqual([
			undefined,
			PetAssistanceState.SUCCESS,
			undefined
		]);
	});

	it("createBomb: the duck holds its bomb when its owner is ahead", async () => {
		const owner = buildPetFighter({
			petTypeId: PetConstants.PETS.SCARLET_DUCK,
			energy: 900
		});

		expect((await createBomb(owner, buildPetFighter({ energy: 800 }), 14, FIGHT))?.assistanceStatus).toBe(PetAssistanceState.FAILURE);
	});

	it("petHit: strikes back half of the time after a physical attack", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.KANGAROO });
		const opponent = buildPetFighter();
		vi.spyOn(opponent, "getLastFightActionUsed").mockReturnValue(FightActionDataController.instance.getById(FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK)!);
		const bool = vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);

		expect((await petHit(owner, opponent, 5, FIGHT))?.assistanceStatus).toBe(PetAssistanceState.SUCCESS);
		expect(bool).toHaveBeenCalledWith(0.5);
	});
});
