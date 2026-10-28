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
			expect(getAiPersonalities(ClassConstants.CLASSES_ID.MYSTIC_MAGE)).toEqual([]);
		});

		it("returns no behavior for a class without personality", () => {
			expect(getAiClassBehavior(-2)).toBeUndefined();
		});

		it("offers several personalities to the classes that have more than one viable strategy", () => {
			initializeAllClassBehaviors();

			expect(personalitiesOf(ClassConstants.CLASSES_ID.VALIANT_KNIGHT)).toEqual([KnightFightBehavior, KnightEnduringFightBehavior, KnightFieryFightBehavior]);
			expect(personalitiesOf(ClassConstants.CLASSES_ID.IMPENETRABLE_TANK)).toEqual([TankFightBehavior, TankRiposteFightBehavior]);
			expect(personalitiesOf(ClassConstants.CLASSES_ID.LUMINOUS_PALADIN)).toEqual([PaladinFightBehavior, PaladinJusticarFightBehavior]);
			expect(personalitiesOf(ClassConstants.CLASSES_ID.MYSTIC_MAGE)).toEqual([MysticMageFightBehavior]);
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
		const tank = mockFighter({ breath: 10 });
		const opponent = mockFighter({ lastActionId: ACTIONS.POWERFUL_ATTACK });

		expect(new TankRiposteFightBehavior().chooseAction(tank, mockFightView(5, opponent)).id).toBe(ACTIONS.COUNTER_ATTACK);
		expect(new TankFightBehavior().chooseAction(tank, mockFightView(5, opponent)).id).toBe(ACTIONS.SHIELD_ATTACK);
	});

	it("the justicar paladin strikes with the divine attack once it rarely misses", () => {
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(false);
		const paladin = mockFighter({ breath: 12 });

		expect(new PaladinJusticarFightBehavior().chooseAction(paladin, mockFightView(11, mockFighter())).id).toBe(ACTIONS.DIVINE_ATTACK);
		expect(new PaladinFightBehavior().chooseAction(paladin, mockFightView(11, mockFighter())).id).toBe(ACTIONS.SHIELD_ATTACK);
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

	it("the charger veteran starts a two-turn charging attack", () => {
		const veteran = mockFighter({ breath: 8 });
		const opponent = mockFighter({ lastActionId: ACTIONS.SIMPLE_ATTACK });

		expect(new VeteranChargerFightBehavior().chooseAction(veteran, mockFightView(5, opponent)).id).toBe(ACTIONS.CHARGE_CHARGING_ATTACK);
	});
});
