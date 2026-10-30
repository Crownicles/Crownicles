import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { FightActionController } from "../../../../../src/core/fights/actions/FightActionController";
import darkAttackUse from "../../../../../src/core/fights/actions/interfaces/players/darkAttack";
import { getDarkAttackPowerMultiplier } from "../../../../../src/core/fights/actions/DarkAttackWear";
import { FightAlterationDataController } from "../../../../../src/data/FightAlteration";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { FightActionStatus } from "../../../../../../Lib/src/types/FightActionStatus";
import { TestFighter } from "./TestFighter";
import type { FightAction } from "../../../../../src/data/FightAction";
import type { FightController } from "../../../../../src/core/fights/FightController";

const ACTIONS = FightConstants.FIGHT_ACTIONS.PLAYER;
const DARK_ATTACK = { id: ACTIONS.DARK_ATTACK } as FightAction;
const OTHER_ACTION = { id: ACTIONS.FIRE_ATTACK } as FightAction;
const BASE_DAMAGE = 100;

/**
 * Mage whose previous actions are the given sequence: "D" for a dark attack, "x" for any other action
 */
function mageAfter(sequence: string): TestFighter {
	const mage = new TestFighter();
	mage.fightActionsHistory = [...sequence].map(action => (action === "D" ? DARK_ATTACK : OTHER_ACTION));
	return mage;
}

function useDarkAttack(sender: TestFighter, receiver: TestFighter, status = FightActionStatus.NORMAL): ReturnType<typeof darkAttackUse> {
	vi.spyOn(FightActionController, "applySecondaryEffects").mockReturnValue({
		damages: BASE_DAMAGE, status
	});
	const result = darkAttackUse(sender, receiver, DARK_ATTACK, 3, null as unknown as FightController);

	// The fight controller pushes the played action to the history right after it
	sender.fightActionsHistory.push(DARK_ATTACK);
	return result;
}

describe("dark attack wear", () => {
	it("starts strong and loses one step per use down to its floor", () => {
		expect(["", "D", "DD", "DDD", "DDDD", "DDDDD", "DDDDDDDD"].map(sequence => getDarkAttackPowerMultiplier(mageAfter(sequence))))
			.toEqual([1.7, 1.4, 1.1, 0.8, 0.5, 0.3, 0.3]);
	});

	it("gets one step back every two actions in a row without it", () => {
		expect(["DDx", "DDxx", "DDxxxx", "DDxxxxxx", "DDxDx"].map(sequence => getDarkAttackPowerMultiplier(mageAfter(sequence))))
			.toEqual([1.1, 1.4, 1.7, 1.7, 0.8]);
	});
});

describe("darkAttack", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("deals its damage multiplied by its current power and no longer blinds", () => {
		const receiver = new TestFighter();

		const freshResult = useDarkAttack(mageAfter(""), receiver);
		const wornResult = useDarkAttack(mageAfter("DDD"), receiver);

		expect(freshResult.damages).toBe(170);
		expect(wornResult.damages).toBe(80);
		expect(receiver.hasFightAlteration()).toBe(false);
		expect(freshResult.alterations).toBeUndefined();
	});

	it("no longer gives breath back against an opponent with an alteration", () => {
		const mage = mageAfter("");
		mage.setBreath(2);
		const receiver = new TestFighter();
		receiver.newAlteration(FightAlterationDataController.instance.getById(FightConstants.FIGHT_ACTIONS.ALTERATION.POISONED)!);

		useDarkAttack(mage, receiver);

		expect(mage.getBreath()).toBe(2);
	});

	it("is not worn down by a missed use, unlike a landed one", () => {
		const missingMage = mageAfter("");
		const hittingMage = mageAfter("");

		useDarkAttack(missingMage, new TestFighter(), FightActionStatus.MISSED);
		useDarkAttack(hittingMage, new TestFighter());

		expect(getDarkAttackPowerMultiplier(missingMage)).toBe(1.7);
		expect(getDarkAttackPowerMultiplier(hittingMage)).toBe(1.4);
	});
});
