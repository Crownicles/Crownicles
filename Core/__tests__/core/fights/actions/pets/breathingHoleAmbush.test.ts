import {
	beforeEach, describe, expect, it, vi
} from "vitest";
import breathingHoleAmbush from "../../../../../src/core/fights/actions/interfaces/pets/breathingHoleAmbush";
import claws from "../../../../../src/core/fights/actions/interfaces/pets/claws";
import { PetAssistanceState } from "../../../../../../Lib/src/types/PetAssistanceResult";
import { PetConstants } from "../../../../../../Lib/src/constants/PetConstants";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import type { FightController } from "../../../../../src/core/fights/FightController";
import type { FightAction } from "../../../../../src/data/FightAction";
import { buildPetFighter } from "./PetFighterMocks";

const FIGHT = {} as FightController;

/*
 * Measured on the PvP fights of the last 30 days: 18.8 turns on average (9.4 per fighter)
 * and 57% of the fighters rest or run out of breath at least once
 */
const OWNER_TURNS_PER_FIGHT = 9.4;
const SHARE_OF_FIGHTS_WITH_A_REST = 0.57;
const CLAWS_TRIGGER_CHANCE = 0.3;

describe("breathingHoleAmbush pet assistance (polar bear)", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(RandomUtils, "variationInt").mockReturnValue(0);
	});

	it("waits while the opponent keeps attacking", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.POLAR_BEAR });
		const opponent = buildPetFighter({ lastActionId: FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK });

		expect(await breathingHoleAmbush(owner, opponent, 3, FIGHT)).toBeNull();
		expect(await breathingHoleAmbush(owner, buildPetFighter(), 1, FIGHT)).toBeNull();
	});

	it("strikes only once, the first time the opponent rests", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.POLAR_BEAR });
		const opponent = buildPetFighter({ lastActionId: FightConstants.FIGHT_ACTIONS.PLAYER.RESTING });

		const ambush = await breathingHoleAmbush(owner, opponent, 5, FIGHT);

		expect(ambush?.assistanceStatus).toBe(PetAssistanceState.SUCCESS);
		expect(ambush?.damages).toBeGreaterThan(0);
		expect(await breathingHoleAmbush(owner, opponent, 7, FIGHT)).toBeNull();
	});

	it("strikes when the opponent ran out of breath", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.POLAR_BEAR });
		const opponent = buildPetFighter({ lastActionId: FightConstants.FIGHT_ACTIONS.ALTERATION.OUT_OF_BREATH });

		expect((await breathingHoleAmbush(owner, opponent, 5, FIGHT))?.assistanceStatus).toBe(PetAssistanceState.SUCCESS);
	});

	it.each([
		[500, 400],
		[800, 600],
		[1100, 900]
	])("deals around 90%% of the damage of a tiger over a fight (defense %i, speed %i)", async (defense, speed) => {
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
		const opponent = buildPetFighter({
			defense,
			speed,
			lastActionId: FightConstants.FIGHT_ACTIONS.PLAYER.RESTING
		});
		const tigerOwner = buildPetFighter({ petTypeId: PetConstants.PETS.TIGER });
		const bearOwner = buildPetFighter({ petTypeId: PetConstants.PETS.POLAR_BEAR });

		const tigerDamagesPerFight = (await claws(tigerOwner, opponent, 1, FIGHT))!.damages! * CLAWS_TRIGGER_CHANCE * OWNER_TURNS_PER_FIGHT;
		const bearDamagesPerFight = (await breathingHoleAmbush(bearOwner, opponent, 1, FIGHT))!.damages! * SHARE_OF_FIGHTS_WITH_A_REST;

		const ratio = bearDamagesPerFight / tigerDamagesPerFight;
		expect(ratio).toBeGreaterThan(0.8);
		expect(ratio).toBeLessThanOrEqual(1);
	});

	it("ignores the opponent's actions older than its last one", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.POLAR_BEAR });
		const opponent = buildPetFighter({ lastActionId: FightConstants.FIGHT_ACTIONS.PLAYER.RESTING });
		opponent.fightActionsHistory.push({ id: FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK } as FightAction);

		expect(await breathingHoleAmbush(owner, opponent, 5, FIGHT)).toBeNull();
	});
});
