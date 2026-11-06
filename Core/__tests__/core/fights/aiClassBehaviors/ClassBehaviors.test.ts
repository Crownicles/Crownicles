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

		it("opens with its charged attack, even against a mage it used to protect itself from", () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);
			const mage = mockFighter({
				classId: ClassConstants.CLASSES_ID.MYSTIC_MAGE, breath: 10
			});

			expect(new InfantryManFightBehavior().chooseAction(mockFighter(), mockFightView(2, mage)).id).toBe(ACTIONS.CHARGE_CHARGING_ATTACK);
			expect(new InfantryManFightBehavior().chooseAction(mockFighter(), mockFightView(6, mage)).id).not.toBe(ACTIONS.PROTECTION);
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

		it("strikes a stunned opponent with its shield instead of ramming it, which would stun it again", () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
			const paladin = (): ReturnType<typeof mockFighter> => mockFighter({ breath: 6 });
			const stunned = mockFighter({
				alterationId: ALTERATIONS.STUNNED, lastActionId: ACTIONS.SIMPLE_ATTACK
			});

			expect(new PaladinFightBehavior().chooseAction(paladin(), mockFightView(3, stunned)).id).toBe(ACTIONS.SHIELD_ATTACK);
			expect(new PaladinFightBehavior().chooseAction(mockFighter({ breath: 5 }), mockFightView(3, stunned)).id).toBe(ACTIONS.SIMPLE_ATTACK);
		});

		it("rams a weakened opponent, which the ram cannot stun, but never a clean one", () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
			const paladin = (): ReturnType<typeof mockFighter> => mockFighter({ breath: 5 });
			const weakened = mockFighter({ alterationId: ALTERATIONS.WEAK, lastActionId: ACTIONS.SIMPLE_ATTACK });

			expect(new PaladinFightBehavior().chooseAction(paladin(), mockFightView(3, weakened)).id).toBe(ACTIONS.RAM_ATTACK);
			expect(new PaladinFightBehavior().chooseAction(paladin(), mockFightView(3, mockFighter())).id).toBe(ACTIONS.SIMPLE_ATTACK);
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
		it("opens with the boomerang on a clean opponent", () => {
			const gunner = mockFighter({ breath: 8 });

			expect(new GunnerFightBehavior().chooseAction(gunner, mockFightView(2, mockFighter())).id).toBe(ACTIONS.BOOMERANG_ATTACK);
		});

		it("starts a canon chain close to its full breath and fires at most three canons in a row", () => {
			const gunnerState = {
				breath: 10, maxBreath: 12, lastActionId: null as string | null
			};
			const gunner = mockFighter(gunnerState);
			const behavior = new GunnerFightBehavior();
			const opponent = mockFighter({ speed: 50 });
			const actions = [3, 5, 7, 9].map(turn => {
				const action = behavior.chooseAction(gunner, mockFightView(turn, opponent)).id;
				// The canons in a row are paid with the breath left: below the threshold that starts a chain
				gunnerState.lastActionId = action;
				gunnerState.breath = 6;
				return action;
			});

			expect(actions).toEqual([ACTIONS.CANON_ATTACK, ACTIONS.CANON_ATTACK, ACTIONS.CANON_ATTACK, ACTIONS.SABOTAGE_ATTACK]);
		});

		it("sabotages between two chains, and uses its intense attack against an opponent nearly as fast", () => {
			const gunner = (): ReturnType<typeof mockFighter> => mockFighter({
				breath: 7, maxBreath: 12, speed: 500
			});

			expect(new GunnerFightBehavior().chooseAction(gunner(), mockFightView(5, mockFighter({ speed: 100 }))).id).toBe(ACTIONS.SABOTAGE_ATTACK);
			expect(new GunnerFightBehavior().chooseAction(gunner(), mockFightView(5, mockFighter({ speed: 450 }))).id).toBe(ACTIONS.INTENSE_ATTACK);
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
