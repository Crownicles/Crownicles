import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { FightActionController } from "../../../../../src/core/fights/actions/FightActionController";
import breathTakingAttackUse from "../../../../../src/core/fights/actions/interfaces/players/breathTakingAttack";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
import { TestFighter } from "./TestFighter";
import type { FightAction } from "../../../../../src/data/FightAction";
import type { FightController } from "../../../../../src/core/fights/FightController";

const BREATH_TAKING_ATTACK = { id: "breathTakingAttack" } as FightAction;

function useBreathTakingAttack(sender: TestFighter, receiver: TestFighter, slowsOpponent: boolean): void {
	vi.spyOn(RandomUtils.crowniclesRandom, "bool").mockReturnValue(slowsOpponent);
	vi.spyOn(FightActionController, "getAttackDamage").mockReturnValue(60);
	breathTakingAttackUse(sender, receiver, BREATH_TAKING_ATTACK, 1, null as unknown as FightController);
}

describe("breathTakingAttack", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("steals two points of breath from the opponent when it does not slow them", () => {
		const sender = new TestFighter({ breath: 2 });
		const receiver = new TestFighter({ breath: 8 });

		useBreathTakingAttack(sender, receiver, false);

		expect(receiver.getBreath()).toBe(6);
		expect(sender.getBreath()).toBe(4);
	});

	it("only steals the breath the opponent still has", () => {
		const sender = new TestFighter({ breath: 2 });
		const receiver = new TestFighter({ breath: 1 });

		useBreathTakingAttack(sender, receiver, false);

		expect(receiver.getBreath()).toBe(0);
		expect(sender.getBreath()).toBe(3);
	});

	it("slows the opponent without stealing breath on the slowing branch", () => {
		const sender = new TestFighter({ breath: 2 });
		const receiver = new TestFighter({
			breath: 8, speed: 100
		});

		useBreathTakingAttack(sender, receiver, true);

		expect(receiver.getBreath()).toBe(8);
		expect(sender.getBreath()).toBe(2);
		expect(receiver.getSpeed()).toBe(85);
	});
});
