import {
	describe, expect, it
} from "vitest";
import {
	customMessageActionResult, customMessageFailActionResult, defaultFailFightActionResult, defaultFightActionResult,
	defaultMaxUsesFightActionResult, fightActionResultFromSuccessTest, FightActionResult,
	updateFightActionResultFromSuccessTest
} from "../../src/types/FightActionResult";
import { FightActionStatus } from "../../src/types/FightActionStatus";

describe("FightActionResult factories", () => {
	it("builds successful results, with the custom message only when asked", () => {
		expect(defaultFightActionResult()).toEqual({
			attackStatus: FightActionStatus.NORMAL, customMessage: false
		});
		expect(customMessageActionResult()).toEqual({
			attackStatus: FightActionStatus.NORMAL, customMessage: true
		});
	});

	it("builds failed results with the status the fight display expects", () => {
		expect(defaultFailFightActionResult()).toEqual({
			fail: true, attackStatus: FightActionStatus.MISSED
		});
		expect(customMessageFailActionResult()).toEqual({
			fail: true, attackStatus: FightActionStatus.MISSED, customMessageFail: true
		});
		expect(defaultMaxUsesFightActionResult()).toEqual({
			fail: true, attackStatus: FightActionStatus.MAX_USES
		});
	});

	it("gives a new result on every call so that an action cannot alter the next one", () => {
		const first = defaultFightActionResult();
		first.damages = 10;

		expect(defaultFightActionResult().damages).toBeUndefined();
	});
});

describe("fightActionResultFromSuccessTest", () => {
	it("gives a normal result on success and a missed one on failure", () => {
		expect(fightActionResultFromSuccessTest(true)).toEqual(defaultFightActionResult());
		expect(fightActionResultFromSuccessTest(false)).toEqual(defaultFailFightActionResult());
	});
});

describe("updateFightActionResultFromSuccessTest", () => {
	function resultWithDamages(): FightActionResult {
		return {
			attackStatus: FightActionStatus.CRITICAL,
			damages: 42
		};
	}

	it("marks the given result as missed on failure and keeps its other fields", () => {
		const result = resultWithDamages();

		expect(updateFightActionResultFromSuccessTest(result, false)).toBe(result);
		expect(result).toEqual({
			attackStatus: FightActionStatus.MISSED, damages: 42, fail: true
		});
	});

	it("marks the given result as normal on success", () => {
		const result = resultWithDamages();

		updateFightActionResultFromSuccessTest(result, true);

		expect(result).toEqual({
			attackStatus: FightActionStatus.NORMAL, damages: 42, fail: false
		});
	});
});
