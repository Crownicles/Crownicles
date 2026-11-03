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
 * Measured on AI fights between the level 100+ players of the game (their real class and gear):
 * the claws strike 2.75 times per fight and the bear ambushes in 53% of the fights
 * (57% of the PvP fighters of the last 30 days rest or run out of breath at least once)
 */
const CLAWS_STRIKES_PER_FIGHT = 2.75;
const AMBUSHES_PER_FIGHT = 0.53;

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

	// Defense and speed quartiles (25%, 50%, 75%) of the level 100+ players
	it.each([
		[334, 159],
		[446, 314],
		[572, 465]
	])("deals a bit less damage than a tiger over a fight (defense %i, speed %i)", async (defense, speed) => {
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
		const opponent = buildPetFighter({
			defense,
			speed,
			lastActionId: FightConstants.FIGHT_ACTIONS.PLAYER.RESTING
		});
		const tigerOwner = buildPetFighter({ petTypeId: PetConstants.PETS.TIGER });
		const bearOwner = buildPetFighter({ petTypeId: PetConstants.PETS.POLAR_BEAR });

		const tigerDamagesPerFight = (await claws(tigerOwner, opponent, 1, FIGHT))!.damages! * CLAWS_STRIKES_PER_FIGHT;
		const bearDamagesPerFight = (await breathingHoleAmbush(bearOwner, opponent, 1, FIGHT))!.damages! * AMBUSHES_PER_FIGHT;

		const ratio = bearDamagesPerFight / tigerDamagesPerFight;
		expect(ratio).toBeGreaterThan(0.85);
		expect(ratio).toBeLessThanOrEqual(1);
	});

	it("ignores the opponent's actions older than its last one", async () => {
		const owner = buildPetFighter({ petTypeId: PetConstants.PETS.POLAR_BEAR });
		const opponent = buildPetFighter({ lastActionId: FightConstants.FIGHT_ACTIONS.PLAYER.RESTING });
		opponent.fightActionsHistory.push({ id: FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK } as FightAction);

		expect(await breathingHoleAmbush(owner, opponent, 5, FIGHT)).toBeNull();
	});
});
