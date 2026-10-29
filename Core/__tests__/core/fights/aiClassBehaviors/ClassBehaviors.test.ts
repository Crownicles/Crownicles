import {
	afterEach, describe, expect, it, vi
} from "vitest";
import KnightFightBehavior from "../../../../src/core/fights/aiClassBehaviors/KnightFightBehavior";
import PaladinFightBehavior from "../../../../src/core/fights/aiClassBehaviors/PaladinFightBehavior";
import MysticMageFightBehavior from "../../../../src/core/fights/aiClassBehaviors/MysticMageFightBehavior";
import GunnerFightBehavior from "../../../../src/core/fights/aiClassBehaviors/GunnerFightBehavior";
import VeteranFightBehavior from "../../../../src/core/fights/aiClassBehaviors/VeteranFightBehavior";
import InfantryManFightBehavior from "../../../../src/core/fights/aiClassBehaviors/InfantrymanFightBehavior";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
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

	describe("InfantrymanFightBehavior", () => {
		it("protects itself from a paladin able to stun or weaken it", () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
			const paladin = mockFighter({
				classId: ClassConstants.CLASSES_ID.LUMINOUS_PALADIN, breath: 10
			});

			expect(new InfantryManFightBehavior().chooseAction(mockFighter(), mockFightView(5, paladin)).id).toBe(ACTIONS.PROTECTION);
		});

		it("keeps attacking while already protected", () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
			const tank = mockFighter({
				classId: ClassConstants.CLASSES_ID.IMPENETRABLE_TANK, breath: 10
			});
			const infantryman = mockFighter({ alterationId: ALTERATIONS.PROTECTED });

			expect(new InfantryManFightBehavior().chooseAction(infantryman, mockFightView(5, tank)).id).not.toBe(ACTIONS.PROTECTION);
		});

		it("does not waste a turn protecting itself from a class without control attack", () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
			const knight = mockFighter({
				classId: ClassConstants.CLASSES_ID.KNIGHT, breath: 10
			});

			expect(new InfantryManFightBehavior().chooseAction(mockFighter(), mockFightView(5, knight)).id).not.toBe(ACTIONS.PROTECTION);
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
		it("sets up a poison on a clean opponent at the start of the fight", () => {
			const mage = mockFighter({ breath: 16 });
			const opponent = mockFighter();

			expect(new MysticMageFightBehavior().chooseAction(mage, mockFightView(1, opponent)).id).toBe(ACTIONS.POISONOUS_ATTACK);
		});

		it("curses an opponent that heals itself before anything else", () => {
			const mage = mockFighter({ breath: 16 });
			const knight = mockFighter({ actions: [ACTIONS.SIMPLE_ATTACK, ACTIONS.HEAVY_ATTACK, ACTIONS.RESTING] });

			expect(new MysticMageFightBehavior().chooseAction(mage, mockFightView(1, knight)).id).toBe(ACTIONS.CURSED_ATTACK);
		});

		it("cashes in the ailment of its opponent with a fresh dark attack", () => {
			const mage = mockFighter({ breath: 16 });
			const opponent = mockFighter({ alterationId: ALTERATIONS.POISONED });

			expect(new MysticMageFightBehavior().chooseAction(mage, mockFightView(4, opponent)).id).toBe(ACTIONS.DARK_ATTACK);
		});

		it("saves its breath for the dark attack rather than spending it on a weaker hit", () => {
			const mage = mockFighter({ breath: 3 });
			const opponent = mockFighter({ alterationId: ALTERATIONS.POISONED });

			expect(new MysticMageFightBehavior().chooseAction(mage, mockFightView(4, opponent)).id).toBe(ACTIONS.BREATH_TAKING_ATTACK);
		});

		it("leaves its worn dark attack aside and keeps fighting with fire", () => {
			const mage = mockFighter({
				breath: 16,
				history: [ACTIONS.DARK_ATTACK, ACTIONS.DARK_ATTACK, ACTIONS.DARK_ATTACK, ACTIONS.DARK_ATTACK]
			});
			const opponent = mockFighter({ alterationId: ALTERATIONS.POISONED });

			expect(new MysticMageFightBehavior().chooseAction(mage, mockFightView(10, opponent)).id).toBe(ACTIONS.FIRE_ATTACK);
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

		it("punishes an opponent that has just rested with an energetic attack", () => {
			const veteran = mockFighter({ breath: 10 });
			const opponent = mockFighter({ lastActionId: ACTIONS.RESTING });

			expect(new VeteranFightBehavior().chooseAction(veteran, mockFightView(5, opponent)).id).toBe(ACTIONS.ENERGETIC_ATTACK);
		});

		it("spends its concentration on an energetic attack", () => {
			const veteran = mockFighter({
				breath: 10, alterationId: ALTERATIONS.CONCENTRATED
			});

			expect(new VeteranFightBehavior().chooseAction(veteran, mockFightView(5, mockFighter())).id).toBe(ACTIONS.ENERGETIC_ATTACK);
		});
	});
});
