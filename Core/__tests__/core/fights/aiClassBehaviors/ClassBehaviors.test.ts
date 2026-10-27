import {
	afterEach, describe, expect, it, vi
} from "vitest";
import KnightFightBehavior from "../../../../src/core/fights/aiClassBehaviors/KnightFightBehavior";
import PaladinFightBehavior from "../../../../src/core/fights/aiClassBehaviors/PaladinFightBehavior";
import MysticMageFightBehavior from "../../../../src/core/fights/aiClassBehaviors/MysticMageFightBehavior";
import GunnerFightBehavior from "../../../../src/core/fights/aiClassBehaviors/GunnerFightBehavior";
import VeteranFightBehavior from "../../../../src/core/fights/aiClassBehaviors/VeteranFightBehavior";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import {
	mockFighter, mockFightView
} from "./AiFighterMocks";

const ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;
const ALTERATIONS = FightConstants.FIGHT_ACTIONS.ALTERATION;

describe("AI class behaviors", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("KnightFightBehavior", () => {
		it("casts the benediction first against an opponent able to use a god move", () => {
			const knight = mockFighter({ breath: 17 });
			const opponent = mockFighter({ actions: [ACTIONS.SIMPLE_ATTACK, ACTIONS.DIVINE_ATTACK] });

			expect(new KnightFightBehavior().chooseAction(knight, mockFightView(1, opponent)).id).toBe(ACTIONS.BENEDICTION);
		});

		it("keeps the benediction for later against an opponent without god move", () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
			const knight = mockFighter({ breath: 17 });
			const opponent = mockFighter({ actions: [ACTIONS.QUICK_ATTACK, ACTIONS.CANON_ATTACK] });

			expect(new KnightFightBehavior().chooseAction(knight, mockFightView(1, opponent)).id).not.toBe(ACTIONS.BENEDICTION);
		});

		it("does not race for a god move already used by the opponent", () => {
			const knight = mockFighter({ breath: 17 });
			const opponent = mockFighter({
				actions: [ACTIONS.BENEDICTION], history: [ACTIONS.BENEDICTION]
			});

			expect(new KnightFightBehavior().chooseAction(knight, mockFightView(2, opponent)).id).not.toBe(ACTIONS.BENEDICTION);
		});
	});

	describe("PaladinFightBehavior", () => {
		it("weakens an opponent without alteration with the shield attack", () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
			const paladin = mockFighter({ breath: 17 });

			expect(new PaladinFightBehavior().chooseAction(paladin, mockFightView(3, mockFighter())).id).toBe(ACTIONS.SHIELD_ATTACK);
		});

		it("rams an opponent that is resting", () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
			const paladin = mockFighter({ breath: 4 });
			const knight = mockFighter({ lastActionId: ACTIONS.RESTING });

			expect(new PaladinFightBehavior().chooseAction(paladin, mockFightView(3, knight)).id).toBe(ACTIONS.RAM_ATTACK);
		});

		it("does not ram a stunned opponent by default, as the ram hurts the paladin", () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
			const paladin = mockFighter({ breath: 25 });
			const opponent = mockFighter({
				alterationId: ALTERATIONS.STUNNED, lastActionId: ACTIONS.SIMPLE_ATTACK
			});

			expect(new PaladinFightBehavior().chooseAction(paladin, mockFightView(3, opponent)).id).toBe(ACTIONS.SIMPLE_ATTACK);
		});
	});

	describe("MysticMageFightBehavior", () => {
		it("blinds an opponent without alteration instead of burning it", () => {
			const mage = mockFighter({ breath: 16 });
			const opponent = mockFighter({ classId: ClassConstants.CLASSES_ID.VALIANT_KNIGHT });

			expect(new MysticMageFightBehavior().chooseAction(mage, mockFightView(4, opponent)).id).toBe(ACTIONS.DARK_ATTACK);
		});
	});

	describe("GunnerFightBehavior", () => {
		it("leaves its canon sequence after three canons and throws its boomerang again", () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
			const gunner = mockFighter({
				breath: 12, speed: 500
			});
			const opponentState = {
				speed: 100, alterationId: ALTERATIONS.SLOWED as string | null
			};
			const opponent = mockFighter(opponentState);
			const behavior = new GunnerFightBehavior();
			const firstActions = [3, 5, 7].map(turn => behavior.chooseAction(gunner, mockFightView(turn, opponent)).id);

			// The opponent recovers from its alteration and becomes fast: the boomerang is worth throwing again
			opponentState.alterationId = null;
			opponentState.speed = 450;

			expect(firstActions).toEqual([ACTIONS.CANON_ATTACK, ACTIONS.CANON_ATTACK, ACTIONS.CANON_ATTACK]);
			expect(behavior.chooseAction(gunner, mockFightView(9, opponent)).id).toBe(ACTIONS.BOOMERANG_ATTACK);
		});
	});

	describe("VeteranFightBehavior", () => {
		it("concentrates when it will afford an energetic attack on its next turn", () => {
			const veteran = mockFighter({
				breath: 6, regenBreath: 5
			});

			expect(new VeteranFightBehavior().chooseAction(veteran, mockFightView(3, mockFighter())).id).toBe(ACTIONS.CONCENTRATION);
		});

		it("spends its concentration on an energetic attack", () => {
			const veteran = mockFighter({
				breath: 10, alterationId: ALTERATIONS.CONCENTRATED
			});

			expect(new VeteranFightBehavior().chooseAction(veteran, mockFightView(5, mockFighter())).id).toBe(ACTIONS.ENERGETIC_ATTACK);
		});
	});
});
