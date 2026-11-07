import {
	afterEach, describe, expect, it, vi
} from "vitest";
import { FightActionController } from "../../../../../src/core/fights/actions/FightActionController";
import darkAttackUse from "../../../../../src/core/fights/actions/interfaces/players/darkAttack";
import { getDarkAttackPowerMultiplier } from "../../../../../src/core/fights/actions/DarkAttackWear";
import { FightAlterationDataController } from "../../../../../src/data/FightAlteration";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import { FightActionStatus } from "../../../../../../Lib/src/types/FightActionStatus";
import { RandomUtils } from "../../../../../../Lib/src/utils/RandomUtils";
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
		expect(["", "D", "DD", "DDD", "DDDD", "DDDDD", "DDDDDDDD"].map(sequence => getDarkAttackPowerMultiplier(mageAfter(sequence), new TestFighter())))
			.toEqual([1.6, 1.3, 1, 0.7, 0.4, 0.3, 0.3]);
	});

	it("gets one step back every two actions in a row without it", () => {
		expect(["DDx", "DDxx", "DDxxxx", "DDxxxxxx", "DDxDx"].map(sequence => getDarkAttackPowerMultiplier(mageAfter(sequence), new TestFighter())))
			.toEqual([1, 1.3, 1.6, 1.6, 0.7]);
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

		expect(freshResult.damages).toBe(160);
		expect(wornResult.damages).toBe(70);
		expect(receiver.hasFightAlteration()).toBe(false);
		expect(freshResult.alterations).toBeUndefined();
	});

	it("hits a cursed opponent at full power whatever its wear, and still wears down", () => {
		const mage = mageAfter("DDD");
		const cursedReceiver = new TestFighter();
		cursedReceiver.newAlteration(FightAlterationDataController.instance.getById(FightConstants.FIGHT_ACTIONS.ALTERATION.CURSED)!);
		const poisonedReceiver = new TestFighter();
		poisonedReceiver.newAlteration(FightAlterationDataController.instance.getById(FightConstants.FIGHT_ACTIONS.ALTERATION.POISONED)!);

		expect(useDarkAttack(mage, cursedReceiver).damages).toBe(160);
		expect(useDarkAttack(mageAfter("DDD"), poisonedReceiver).damages).toBe(70);
		expect(getDarkAttackPowerMultiplier(mage, new TestFighter())).toBe(0.4);
	});

	it("no longer gives breath back against an opponent with an alteration", () => {
		const mage = mageAfter("");
		mage.setBreath(2);
		const receiver = new TestFighter();
		receiver.newAlteration(FightAlterationDataController.instance.getById(FightConstants.FIGHT_ACTIONS.ALTERATION.POISONED)!);

		useDarkAttack(mage, receiver);

		expect(mage.getBreath()).toBe(2);
	});

	it("is held back by the defense of a heavily armored target", () => {
		vi.spyOn(RandomUtils, "variationInt").mockReturnValue(0);
		vi.spyOn(FightActionController, "applySecondaryEffects").mockImplementation(damages => ({
			damages,
			status: FightActionStatus.NORMAL
		}));

		const againstLightArmor = darkAttackUse(mageAfter(""), new TestFighter({ defense: 100 }), DARK_ATTACK, 3, null as unknown as FightController);
		const againstHeavyArmor = darkAttackUse(mageAfter(""), new TestFighter({ defense: 1600 }), DARK_ATTACK, 3, null as unknown as FightController);

		// Sixteen times more defense: the armored target takes well under three quarters of the damage
		expect(againstHeavyArmor.damages! / againstLightArmor.damages!).toBeLessThan(0.7);
	});

	it("is not worn down by a missed use, unlike a landed one", () => {
		const missingMage = mageAfter("");
		const hittingMage = mageAfter("");

		useDarkAttack(missingMage, new TestFighter(), FightActionStatus.MISSED);
		useDarkAttack(hittingMage, new TestFighter());

		expect(getDarkAttackPowerMultiplier(missingMage, new TestFighter())).toBe(1.6);
		expect(getDarkAttackPowerMultiplier(hittingMage, new TestFighter())).toBe(1.3);
	});
});
