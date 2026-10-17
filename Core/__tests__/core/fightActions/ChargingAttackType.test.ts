import {
	describe, expect, it
} from "vitest";
import chargingAttack = require("../../../resources/fightActions/chargingAttack.json");
import chargeChargingAttack = require("../../../resources/fightActions/chargeChargingAttack.json");
import { FightActionType } from "../../../../Lib/src/types/FightActionType";

describe("charged attack action types", () => {
	it("treats the preparation phase as physical", () => {
		expect(chargeChargingAttack.type).toBe(FightActionType.PHYSICAL);
	});

	it("treats the final hit as physical damage", () => {
		expect(chargingAttack.type).toBe(FightActionType.PHYSICAL);
	});
});