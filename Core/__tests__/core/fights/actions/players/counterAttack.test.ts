import {
	afterEach, describe, expect, it, vi
} from "vitest";
import counterAttackUse from "../../../../../src/core/fights/actions/interfaces/players/counterAttack";
import {
	FightAction, FightActionDataController
} from "../../../../../src/data/FightAction";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { TestFighter } from "./TestFighter";
import type { FightController } from "../../../../../src/core/fights/FightController";

const COUNTER_ATTACK = { id: FightConstants.FIGHT_ACTIONS.PLAYER.COUNTER_ATTACK } as FightAction;

/**
 * Make the receiver have just used the given action, and the copied action deal the given damage
 */
function counter(params: {
	copiedActionId: string; copiedDamage: number;
}): ReturnType<typeof counterAttackUse> {
	const sender = new TestFighter();
	const receiver = new TestFighter();
	receiver.fightActionsHistory.push({ id: params.copiedActionId } as FightAction);
	vi.spyOn(FightActionDataController, "getFightActionFunction").mockReturnValue(() => ({ damages: params.copiedDamage }));
	return counterAttackUse(sender, receiver, COUNTER_ATTACK, 3, null as unknown as FightController);
}

describe("counterAttack", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("replays the action the opponent just used", () => {
		const result = counter({
			copiedActionId: FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK, copiedDamage: 100
		});

		expect(result.usedAction?.id).toBe(FightConstants.FIGHT_ACTIONS.PLAYER.SIMPLE_ATTACK);
		expect(result.usedAction?.result.damages).toBe(100);
	});

	it("does nothing against an uncounterable action", () => {
		const result = counter({
			copiedActionId: FightConstants.FIGHT_ACTIONS.PLAYER.BENEDICTION, copiedDamage: 100
		});

		expect(result.usedAction).toBeUndefined();
		expect(result.damages).toBe(0);
	});
});
