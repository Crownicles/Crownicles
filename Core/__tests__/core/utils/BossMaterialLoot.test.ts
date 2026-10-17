import {
	describe, expect, it
} from "vitest";
import { generateBossLoot } from "../../../src/core/utils/MaterialLootUtils";
import { MonsterDataController } from "../../../src/data/Monster";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";

const DRAWS_PER_BOSS = 10;

describe("boss material loot", () => {
	it("only drops materials of the defeated boss, within the configured number of drops", () => {
		for (const monster of MonsterDataController.instance.getAllValues()) {
			for (let i = 0; i < DRAWS_PER_BOSS; i++) {
				const loot = generateBossLoot(monster);
				const totalQuantity = loot.reduce((sum, entry) => sum + entry.quantity, 0);

				expect(loot.every(entry => monster.materialLoot.includes(entry.materialId))).toBe(true);
				expect(totalQuantity).toBeGreaterThanOrEqual(PVEConstants.BOSS_LOOT.MIN_DROPS);
				expect(totalQuantity).toBeLessThanOrEqual(PVEConstants.BOSS_LOOT.MAX_DROPS);
			}
		}
	});
});
