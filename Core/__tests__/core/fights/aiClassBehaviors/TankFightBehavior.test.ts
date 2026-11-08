import {
	afterEach, describe, expect, it, vi
} from "vitest";
import TankFightBehavior from "../../../../src/core/fights/aiClassBehaviors/TankFightBehavior";
import { FightConstants } from "../../../../../Lib/src/constants/FightConstants";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import {
	mockFighter, mockFightView
} from "./AiFighterMocks";

const ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;

describe("TankFightBehavior", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("raises its defense on its first turn, whatever its current defense", () => {
		const tank = mockFighter({
			breath: 7, defense: 900
		});

		expect(new TankFightBehavior().chooseAction(tank, mockFightView(1, mockFighter())).id).toBe(ACTIONS.DEFENSE_BUFF);
	});

	it("weakens an opponent without alteration with the shield attack when its chance succeeds", () => {
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);
		const tank = mockFighter({ breath: 10 });

		expect(new TankFightBehavior().chooseAction(tank, mockFightView(5, mockFighter())).id).toBe(ACTIONS.SHIELD_ATTACK);
	});

	it("is less and less likely to weaken its opponent again with its shield: 90%, then 50%, then 20%, never a fourth time", () => {
		const chances: number[] = [];
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockImplementation((chance?: number): boolean => {
			chances.push(chance!);
			return true;
		});
		const tank = mockFighter({ breath: 10 });
		const behavior = new TankFightBehavior();
		const actions = [5, 7, 9, 11].map(turn => behavior.chooseAction(tank, mockFightView(turn, mockFighter())).id);

		expect(actions).toEqual([ACTIONS.SHIELD_ATTACK, ACTIONS.SHIELD_ATTACK, ACTIONS.SHIELD_ATTACK, ACTIONS.INTENSE_ATTACK]);
		expect(chances).toEqual([0.9, 0.5, 0.2]);
	});

	it("strikes with its shield an opponent that suffers another alteration, without using up its weakening shields", () => {
		const chances: number[] = [];
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockImplementation((chance?: number): boolean => {
			chances.push(chance!);
			return false;
		});
		const tank = mockFighter({ breath: 10 });
		const behavior = new TankFightBehavior();
		const poisoned = mockFighter({ alterationId: FightConstants.FIGHT_ACTIONS.ALTERATION.POISONED });

		expect(behavior.chooseAction(tank, mockFightView(5, poisoned)).id).toBe(ACTIONS.SHIELD_ATTACK);
		behavior.chooseAction(tank, mockFightView(7, mockFighter()));
		expect(chances).toEqual([0.9]);
	});

	it("attacks with its intense attack whenever it can afford it", () => {
		const tank = mockFighter({ breath: 10 });
		const weakened = mockFighter({
			alterationId: FightConstants.FIGHT_ACTIONS.ALTERATION.WEAK,
			lastActionId: ACTIONS.SIMPLE_ATTACK
		});

		expect(new TankFightBehavior().chooseAction(tank, mockFightView(5, weakened)).id).toBe(ACTIONS.INTENSE_ATTACK);
	});

	it("does not chain its shield attack on an opponent it already weakened, and counters its heavy attack instead", () => {
		const tank = mockFighter({ breath: 10 });
		const knight = mockFighter({
			alterationId: FightConstants.FIGHT_ACTIONS.ALTERATION.WEAK,
			lastActionId: ACTIONS.HEAVY_ATTACK
		});

		expect(new TankFightBehavior().chooseAction(tank, mockFightView(5, knight)).id).toBe(ACTIONS.COUNTER_ATTACK);
	});

	it("does not counter without enough breath for the counter attack", () => {
		const tank = mockFighter({ breath: 2 });
		const opponent = mockFighter({
			alterationId: FightConstants.FIGHT_ACTIONS.ALTERATION.WEAK,
			lastActionId: ACTIONS.POWERFUL_ATTACK
		});

		expect(new TankFightBehavior().chooseAction(tank, mockFightView(5, opponent)).id).not.toBe(ACTIONS.COUNTER_ATTACK);
	});

	it("does not start an intense attack without enough breath for it", () => {
		const tank = mockFighter({ breath: 3 });
		const opponent = mockFighter({
			alterationId: FightConstants.FIGHT_ACTIONS.ALTERATION.WEAK,
			lastActionId: ACTIONS.SIMPLE_ATTACK
		});

		expect(new TankFightBehavior().chooseAction(tank, mockFightView(15, opponent)).id).toBe(ACTIONS.SIMPLE_ATTACK);
	});
});
