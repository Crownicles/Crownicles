import {
	afterEach, describe, expect, it, vi
} from "vitest";
import {
	ClassBehavior, getAiClassBehavior, getAiPersonalities, initializeAllClassBehaviors, registerClassBehavior
} from "../../../../src/core/fights/AiBehaviorController";
import KnightFightBehavior from "../../../../src/core/fights/aiClassBehaviors/KnightFightBehavior";
import KnightEnduringFightBehavior from "../../../../src/core/fights/aiClassBehaviors/KnightEnduringFightBehavior";
import KnightFieryFightBehavior from "../../../../src/core/fights/aiClassBehaviors/KnightFieryFightBehavior";
import TankFightBehavior from "../../../../src/core/fights/aiClassBehaviors/TankFightBehavior";
import TankRiposteFightBehavior from "../../../../src/core/fights/aiClassBehaviors/TankRiposteFightBehavior";
import PaladinFightBehavior from "../../../../src/core/fights/aiClassBehaviors/PaladinFightBehavior";
import PaladinJusticarFightBehavior from "../../../../src/core/fights/aiClassBehaviors/PaladinJusticarFightBehavior";
import GunnerBombardierFightBehavior from "../../../../src/core/fights/aiClassBehaviors/GunnerBombardierFightBehavior";
import VeteranChargerFightBehavior from "../../../../src/core/fights/aiClassBehaviors/VeteranChargerFightBehavior";
import MysticMageFightBehavior from "../../../../src/core/fights/aiClassBehaviors/MysticMageFightBehavior";
import MagePyromancerFightBehavior from "../../../../src/core/fights/aiClassBehaviors/MagePyromancerFightBehavior";
import MageWarlockFightBehavior from "../../../../src/core/fights/aiClassBehaviors/MageWarlockFightBehavior";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { ClassConstants } from "../../../../../Lib/src/constants/ClassConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { AiPersonalityConstants } from "../../../../../Lib/src/constants/AiPersonalityConstants";
import {
	mockFighter, mockFightView
} from "./AiFighterMocks";

const ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;
const PERSONALITIES = AiPersonalityConstants.PERSONALITIES;

/**
 * Behaviors offered to a class, captured from the random pick of its personality
 * @param classId
 */
function personalitiesOf(classId: number): unknown[] {
	const pick = vi.spyOn(RandomUtils.crowniclesRandom, "pick");
	getAiClassBehavior(classId);
	return (pick.mock.lastCall?.[0] as { behavior: unknown }[]).map(personality => personality.behavior);
}

describe("AI personalities", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("AiBehaviorController", () => {
		it("builds the personality picked at random among the registered ones", () => {
			class FirstPersonality implements ClassBehavior {
				chooseAction = vi.fn();
			}
			class SecondPersonality implements ClassBehavior {
				chooseAction = vi.fn();
			}
			registerClassBehavior(-1, { behavior: FirstPersonality }, { behavior: SecondPersonality });
			vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(<T>(personalities: readonly T[]): T => personalities[1]);

			expect(getAiClassBehavior(-1)).toBeInstanceOf(SecondPersonality);
		});

		it("builds the personality picked by the player instead of a random one", () => {
			initializeAllClassBehaviors();
			const pick = vi.spyOn(RandomUtils.crowniclesRandom, "pick");

			expect(getAiClassBehavior(ClassConstants.CLASSES_ID.VALIANT_KNIGHT, PERSONALITIES.KNIGHT_ENDURING)).toBeInstanceOf(KnightEnduringFightBehavior);
			expect(pick).not.toHaveBeenCalled();
		});

		it("picks at random when the personality picked by the player belongs to another class", () => {
			initializeAllClassBehaviors();
			vi.spyOn(RandomUtils.crowniclesRandom, "pick").mockImplementation(<T>(personalities: readonly T[]): T => personalities[0]);

			expect(getAiClassBehavior(ClassConstants.CLASSES_ID.IMPENETRABLE_TANK, PERSONALITIES.KNIGHT_ENDURING)).toBeInstanceOf(TankFightBehavior);
		});

		it("lists the personalities a player can pick, none for a class with a single way to fight", () => {
			initializeAllClassBehaviors();

			expect(getAiPersonalities(ClassConstants.CLASSES_ID.LUMINOUS_PALADIN)).toEqual([PERSONALITIES.PALADIN_CRUSADER, PERSONALITIES.PALADIN_JUSTICAR]);
			expect(getAiPersonalities(ClassConstants.CLASSES_ID.POWERFUL_INFANTRYMAN)).toEqual([]);
		});

		it("returns no behavior for a class without personality", () => {
			expect(getAiClassBehavior(-2)).toBeUndefined();
		});

		it("offers several personalities to the classes that have more than one viable strategy", () => {
			initializeAllClassBehaviors();

			expect(personalitiesOf(ClassConstants.CLASSES_ID.VALIANT_KNIGHT)).toEqual([KnightFightBehavior, KnightEnduringFightBehavior, KnightFieryFightBehavior]);
			expect(personalitiesOf(ClassConstants.CLASSES_ID.IMPENETRABLE_TANK)).toEqual([TankFightBehavior, TankRiposteFightBehavior]);
			expect(personalitiesOf(ClassConstants.CLASSES_ID.LUMINOUS_PALADIN)).toEqual([PaladinFightBehavior, PaladinJusticarFightBehavior]);
			expect(personalitiesOf(ClassConstants.CLASSES_ID.MYSTIC_MAGE)).toEqual([MysticMageFightBehavior, MagePyromancerFightBehavior, MageWarlockFightBehavior]);
		});
	});

	describe("knight personalities", () => {
		it("the fiery knight blesses at once against any opponent, the enduring one waits", () => {
			const knight = mockFighter({ breath: 17 });
			const gunner = mockFighter({ actions: [ACTIONS.QUICK_ATTACK, ACTIONS.CANON_ATTACK] });

			expect(new KnightFieryFightBehavior().chooseAction(knight, mockFightView(1, gunner)).id).toBe(ACTIONS.BENEDICTION);
			expect(new KnightEnduringFightBehavior().chooseAction(knight, mockFightView(1, gunner)).id).not.toBe(ACTIONS.BENEDICTION);
		});

		it("the enduring knight rests when slightly hurt, the fiery one keeps attacking", () => {
			const knight = mockFighter({
				breath: 5, regenBreath: 3, energy: 800, history: [ACTIONS.BENEDICTION]
			});

			expect(new KnightEnduringFightBehavior().chooseAction(knight, mockFightView(5, mockFighter())).id).toBe(ACTIONS.RESTING);
			expect(new KnightFieryFightBehavior().chooseAction(knight, mockFightView(5, mockFighter())).id).not.toBe(ACTIONS.RESTING);
		});

		it("follows a rest with a heavy attack", () => {
			const knight = mockFighter({
				breath: 8, lastActionId: ACTIONS.RESTING, history: [ACTIONS.BENEDICTION]
			});

			expect(new KnightEnduringFightBehavior().chooseAction(knight, mockFightView(7, mockFighter())).id).toBe(ACTIONS.HEAVY_ATTACK);
		});
	});

	it("the riposte tank copies an expensive action where the bulwark weakens its opponent", () => {
		// The bulwark casts its first shield attack of the fight when its chance succeeds
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);
		const tank = mockFighter({ breath: 10 });
		const opponent = mockFighter({ lastActionId: ACTIONS.POWERFUL_ATTACK });

		expect(new TankRiposteFightBehavior().chooseAction(tank, mockFightView(5, opponent)).id).toBe(ACTIONS.COUNTER_ATTACK);
		expect(new TankFightBehavior().chooseAction(tank, mockFightView(5, opponent)).id).toBe(ACTIONS.SHIELD_ATTACK);
	});

	it("the riposte tank does not waste its counter attack on a cheap action", () => {
		const tank = mockFighter({ breath: 10 });
		const opponent = mockFighter({ lastActionId: ACTIONS.INTENSE_ATTACK });

		expect(new TankRiposteFightBehavior().chooseAction(tank, mockFightView(5, opponent)).id).not.toBe(ACTIONS.COUNTER_ATTACK);
	});

	it("the justicar paladin strikes with the divine attack once it rarely misses", () => {
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
		const paladin = mockFighter({ breath: 12 });

		expect(new PaladinJusticarFightBehavior().chooseAction(paladin, mockFightView(11, mockFighter())).id).toBe(ACTIONS.DIVINE_ATTACK);
		expect(new PaladinFightBehavior().chooseAction(paladin, mockFightView(11, mockFighter())).id).toBe(ACTIONS.SIMPLE_ATTACK);
	});

	describe("paladin breath reserve", () => {
		it("keeps its breath for its ultimate and its divine attacks instead of opening with the shield attack", () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
			const paladin = mockFighter({
				breath: 17, maxBreath: 25, regenBreath: 3
			});

			expect(new PaladinFightBehavior().chooseAction(paladin, mockFightView(1, mockFighter())).id).toBe(ACTIONS.SIMPLE_ATTACK);
		});

		it("spends the breath of a divine attack the opponent's benediction made impossible", () => {
			vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
			const paladin = (): ReturnType<typeof mockFighter> => mockFighter({
				breath: 25, maxBreath: 30, regenBreath: 3
			});
			const blessedKnight = mockFighter({ history: [ACTIONS.BENEDICTION] });

			expect(new PaladinFightBehavior().chooseAction(paladin(), mockFightView(5, mockFighter())).id).toBe(ACTIONS.SIMPLE_ATTACK);
			expect(new PaladinFightBehavior().chooseAction(paladin(), mockFightView(5, blessedKnight)).id).toBe(ACTIONS.SHIELD_ATTACK);
		});
	});

	describe("bombardier gunner", () => {
		it("opens with the boomerang", () => {
			const gunner = mockFighter({ breath: 10 });

			expect(new GunnerBombardierFightBehavior().chooseAction(gunner, mockFightView(1, mockFighter())).id).toBe(ACTIONS.BOOMERANG_ATTACK);
		});

		it("keeps chaining canons while it has the breath", () => {
			const gunner = mockFighter({
				breath: 6, lastActionId: ACTIONS.CANON_ATTACK
			});

			expect(new GunnerBombardierFightBehavior().chooseAction(gunner, mockFightView(5, mockFighter())).id).toBe(ACTIONS.CANON_ATTACK);
		});
	});

	it("the charger veteran punishes an opponent that has just rested with an energetic attack", () => {
		const veteran = mockFighter({ breath: 10 });
		const opponent = mockFighter({ lastActionId: ACTIONS.RESTING });

		expect(new VeteranChargerFightBehavior().chooseAction(veteran, mockFightView(5, opponent)).id).toBe(ACTIONS.ENERGETIC_ATTACK);
	});

	it("the charger veteran concentrates as soon as its next energetic attack is affordable, instead of charging", () => {
		const veteran = mockFighter({
			breath: 8, regenBreath: 5
		});
		const opponent = mockFighter({ lastActionId: ACTIONS.SIMPLE_ATTACK });

		expect(new VeteranChargerFightBehavior().chooseAction(veteran, mockFightView(5, opponent)).id).toBe(ACTIONS.CONCENTRATION);
	});

	it("the charger veteran keeps its breath with quick attacks while it cannot concentrate", () => {
		const veteran = mockFighter({
			breath: 4, regenBreath: 5
		});

		expect(new VeteranChargerFightBehavior().chooseAction(veteran, mockFightView(5, mockFighter())).id).toBe(ACTIONS.QUICK_ATTACK);
	});

	describe("mage personalities", () => {
		it("the pyromancer curses its opponent with its first move", () => {
			const mage = mockFighter({ breath: 9 });

			expect(new MagePyromancerFightBehavior().chooseAction(mage, mockFightView(2, mockFighter())).id).toBe(ACTIONS.CURSED_ATTACK);
		});

		it("the pyromancer burns its opponent once its curse has fallen, where the occultist curses it again", () => {
			const mage = mockFighter({ breath: 10 });
			const pyromancer = new MagePyromancerFightBehavior();
			pyromancer.chooseAction(mage, mockFightView(2, mockFighter({ alterationId: FightConstants.FIGHT_ACTIONS.ALTERATION.CURSED })));

			expect(pyromancer.chooseAction(mage, mockFightView(6, mockFighter())).id).toBe(ACTIONS.FIRE_ATTACK);
			expect(new MysticMageFightBehavior().chooseAction(mage, mockFightView(6, mockFighter())).id).toBe(ACTIONS.CURSED_ATTACK);
		});

		it("the pyromancer curses again an opponent that resisted its curse", () => {
			const mage = mockFighter({
				breath: 10, history: [ACTIONS.CURSED_ATTACK]
			});

			expect(new MagePyromancerFightBehavior().chooseAction(mage, mockFightView(4, mockFighter())).id).toBe(ACTIONS.CURSED_ATTACK);
		});

		it("the warlock still curses a weakened opponent that the occultist burns instead", () => {
			const mage = mockFighter({ breath: 10 });
			const weakened = (): ReturnType<typeof mockFighter> => mockFighter({ energy: 300 });

			expect(new MageWarlockFightBehavior().chooseAction(mage, mockFightView(5, weakened())).id).toBe(ACTIONS.CURSED_ATTACK);
			expect(new MysticMageFightBehavior().chooseAction(mage, mockFightView(5, weakened())).id).toBe(ACTIONS.FIRE_ATTACK);
		});

		it("lets its dark attack recover once it is worn below its second use, and burns its opponent meanwhile", () => {
			const mage = mockFighter({
				breath: 10, history: [ACTIONS.DARK_ATTACK, ACTIONS.DARK_ATTACK]
			});
			const cursed = mockFighter({ alterationId: FightConstants.FIGHT_ACTIONS.ALTERATION.CURSED });

			expect(new MysticMageFightBehavior().chooseAction(mage, mockFightView(6, cursed)).id).toBe(ACTIONS.FIRE_ATTACK);
		});

		it("saves its breath with its cheap attack until it can afford its fresh dark attack", () => {
			const mage = mockFighter({ breath: 3 });
			const cursed = mockFighter({ alterationId: FightConstants.FIGHT_ACTIONS.ALTERATION.CURSED });

			expect(new MysticMageFightBehavior().chooseAction(mage, mockFightView(6, cursed)).id).toBe(ACTIONS.BREATH_TAKING_ATTACK);
		});

		it("every mage personality cashes a cursed opponent in with its fresh dark attack", () => {
			const mage = mockFighter({ breath: 10 });
			const ailing = (): ReturnType<typeof mockFighter> => mockFighter({ alterationId: FightConstants.FIGHT_ACTIONS.ALTERATION.CURSED });

			for (const Behavior of [MysticMageFightBehavior, MagePyromancerFightBehavior, MageWarlockFightBehavior]) {
				expect(new Behavior().chooseAction(mage, mockFightView(5, ailing())).id).toBe(ACTIONS.DARK_ATTACK);
			}
		});
	});
});
