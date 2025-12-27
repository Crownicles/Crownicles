import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";

/**
 * ItemNature enum values for reference:
 * NONE = 0, HEALTH = 1, SPEED = 2, ATTACK = 3, DEFENSE = 4,
 * TIME_SPEEDUP = 5, MONEY = 6, ENERGY = 7
 */
const FIGHT_ITEM_NATURES = [2, 3, 4]; // SPEED, ATTACK, DEFENSE

interface PotionData {
	rarity: number;
	power: number;
	nature: number;
	usages?: number;
	fallbackEmote?: string;
}

describe("Potion Data Validation", () => {
	const potionsPath = resolve(__dirname, "../../../resources/potions");

	it("should have usages defined for all combat potions", () => {
		const potionFiles = readdirSync(potionsPath).filter(file => file.endsWith(".json"));
		const potionsWithoutUsages: string[] = [];

		for (const file of potionFiles) {
			const potionData: PotionData = JSON.parse(
				readFileSync(resolve(potionsPath, file), "utf8")
			);

			// Check if this is a combat potion (SPEED, ATTACK, or DEFENSE)
			if (FIGHT_ITEM_NATURES.includes(potionData.nature)) {
				// Combat potions must have usages defined and be at least 1
				if (potionData.usages === undefined || potionData.usages < 1) {
					potionsWithoutUsages.push(`${file} (nature: ${potionData.nature})`);
				}
			}
		}

		if (potionsWithoutUsages.length > 0) {
			const errorMessage = `The following combat potions are missing the 'usages' property:\n` +
				potionsWithoutUsages.map(p => `  - ${p}`).join("\n") +
				`\n\nCombat potions (SPEED=2, ATTACK=3, DEFENSE=4) must have 'usages' defined.`;

			expect(potionsWithoutUsages, errorMessage).toHaveLength(0);
		}

		// Verify we actually tested some potions
		expect(potionFiles.length).toBeGreaterThan(0);
	});

	it("should have reasonable usage values for combat potions", () => {
		const potionFiles = readdirSync(potionsPath).filter(file => file.endsWith(".json"));
		const invalidUsages: string[] = [];
		const MAX_REASONABLE_USAGES = 15;

		for (const file of potionFiles) {
			const potionData: PotionData = JSON.parse(
				readFileSync(resolve(potionsPath, file), "utf8")
			);

			// Only check combat potions
			if (FIGHT_ITEM_NATURES.includes(potionData.nature) && potionData.usages !== undefined) {
				if (potionData.usages > MAX_REASONABLE_USAGES) {
					invalidUsages.push(`${file}: usages=${potionData.usages} (max expected: ${MAX_REASONABLE_USAGES})`);
				}
			}
		}

		if (invalidUsages.length > 0) {
			const errorMessage = `The following potions have unusually high usage values:\n` +
				invalidUsages.map(p => `  - ${p}`).join("\n");

			expect(invalidUsages, errorMessage).toHaveLength(0);
		}
	});
});
