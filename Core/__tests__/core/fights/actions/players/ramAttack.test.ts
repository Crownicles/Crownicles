import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { FightActionController } from "../../../../../src/core/fights/actions/FightActionController";
import ramAttackUse from "../../../../../src/core/fights/actions/interfaces/players/ramAttack";
import { TestFighter } from "./TestFighter";
import type { FightAction } from "../../../../../src/data/FightAction";
import type { FightController } from "../../../../../src/core/fights/FightController";

const RAM_ATTACK = { id: "ramAttack" } as FightAction;
const COMPUTED_DAMAGE = 80;

describe("ramAttack", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("only inflicts half of the computed recoil to the sender", () => {
		// No stun on the defender nor on the sender: the sender takes the recoil
		vi.spyOn(Math, "random").mockReturnValue(0.99);
		vi.spyOn(FightActionController, "getAttackDamage").mockReturnValue(COMPUTED_DAMAGE);
		const sender = new TestFighter({ energy: 1000 });
		const receiver = new TestFighter();

		ramAttackUse(sender, receiver, RAM_ATTACK, 3, null as unknown as FightController);

		expect(sender.getEnergy()).toBe(1000 - COMPUTED_DAMAGE / 2);
	});
});
