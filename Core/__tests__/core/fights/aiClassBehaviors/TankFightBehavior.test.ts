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

	it("is less and less likely to cast its shield attack again: 90%, then 50%, then 20%", () => {
		const chances: number[] = [];
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockImplementation((chance?: number): boolean => {
			chances.push(chance!);
			return false;
		});
		const tankAfter = (shieldAttacks: number): ReturnType<typeof mockFighter> => mockFighter({
			breath: 10, history: [ACTIONS.DEFENSE_BUFF, ...Array<string>(shieldAttacks).fill(ACTIONS.SHIELD_ATTACK)]
		});

		for (const shieldAttacks of [0, 1, 2]) {
			expect(new TankFightBehavior().chooseAction(tankAfter(shieldAttacks), mockFightView(9, mockFighter())).id).not.toBe(ACTIONS.SHIELD_ATTACK);
		}
		expect(chances).toEqual([0.9, 0.5, 0.2]);
	});

	it("never casts a fourth shield attack in a fight", () => {
		vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(true);
		const tank = mockFighter({
			breath: 10, history: [ACTIONS.DEFENSE_BUFF, ACTIONS.SHIELD_ATTACK, ACTIONS.SHIELD_ATTACK, ACTIONS.SHIELD_ATTACK]
		});

		expect(new TankFightBehavior().chooseAction(tank, mockFightView(9, mockFighter())).id).not.toBe(ACTIONS.SHIELD_ATTACK);
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
		const tank = mockFighter({
			breath: 3, energy: 100
		});
		const opponent = mockFighter({
			alterationId: FightConstants.FIGHT_ACTIONS.ALTERATION.WEAK,
			lastActionId: ACTIONS.SIMPLE_ATTACK
		});
		const behavior = new TankFightBehavior();

		// Spend all the defense buffs the tank stacks while it cannot afford a shield attack
		for (let turn = 3; turn < 15; turn += 2) {
			behavior.chooseAction(tank, mockFightView(turn, opponent));
		}

		expect(behavior.chooseAction(tank, mockFightView(15, opponent)).id).toBe(ACTIONS.SIMPLE_ATTACK);
	});
});
