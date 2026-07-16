import {
	describe, expect, it
} from "vitest";
import { EnchanterCityData } from "../../../Lib/src/packets/interaction/ReactionCollectorCity";
import { LANGUAGE } from "../../../Lib/src/Language";
import { ItemCategory } from "../../../Lib/src/constants/ItemConstants";
import { ItemEnchantment } from "../../../Lib/src/types/ItemEnchantment";
import { buildEnchantmentDescription } from "../../src/commands/player/report/cityMenu/EnchanterMenu";

function createEnchanterData(enchantmentId: string): EnchanterCityData {
	return {
		enchantableItems: [],
		isInventoryEmpty: true,
		hasAtLeastOneEnchantedItem: false,
		unenchantedItemsInOtherSlotCount: 0,
		enchantmentId,
		enchantmentType: "magic",
		enchantmentSlot: ItemCategory.WEAPON,
		enchantmentCost: {
			money: 1000,
			gems: 0
		},
		mageReduction: false,
		playerMoney: 1000,
		playerGems: 0
	};
}

describe("enchanter enchantment descriptions", () => {
	it("provides a player-facing description for every enchantment", () => {
		for (const enchantment of ItemEnchantment.getAllEnchantments()) {
			const description = buildEnchantmentDescription(createEnchanterData(enchantment.id), LANGUAGE.FRENCH);

			expect(description).not.toBe("");
			expect(description).not.toContain("commands:report.city.enchanter.descriptions");
			expect(description).not.toContain("%");
		}
	});

	it("provides a player-facing English description", () => {
		const description = buildEnchantmentDescription(createEnchanterData(ItemEnchantment.PVP_ATTACK_1.id), LANGUAGE.ENGLISH);

		expect(description).toContain("damage dealt to other adventurers");
		expect(description).not.toContain("commands:report.city.enchanter.descriptions");
	});

	it("throws an explicit error for an unknown enchantment", () => {
		expect(() => buildEnchantmentDescription(createEnchanterData("doesNotExist"), LANGUAGE.FRENCH))
			.toThrow("Unknown enchantment 'doesNotExist' in enchanter city data");
	});

	it("explains that attack enchantments affect damage rather than stats", () => {
		const description = buildEnchantmentDescription(createEnchanterData(ItemEnchantment.PVP_ATTACK_1.id), LANGUAGE.FRENCH);

		expect(description).toContain("dégâts");
		expect(description).toContain("sans modifier les statistiques");
		expect(description).not.toContain("%");
	});

	it("explains that defense enchantments reduce damage rather than stats", () => {
		const description = buildEnchantmentDescription(createEnchanterData(ItemEnchantment.DEFENSE_3.id), LANGUAGE.FRENCH);

		expect(description).toContain("dégâts reçus");
		expect(description).toContain("sans augmenter les statistiques");
		expect(description).not.toContain("%");
	});

	it("explains both effects of alteration enchantments", () => {
		const fireDescription = buildEnchantmentDescription(createEnchanterData(ItemEnchantment.BURNED_DAMAGE_1.id), LANGUAGE.FRENCH);
		const frostDescription = buildEnchantmentDescription(createEnchanterData(ItemEnchantment.FROZEN_DAMAGE_1.id), LANGUAGE.FRENCH);
		const poisonDescription = buildEnchantmentDescription(createEnchanterData(ItemEnchantment.POISONED_DAMAGE_1.id), LANGUAGE.FRENCH);

		expect(fireDescription).toContain("dégâts de gel subis");
		expect(frostDescription).toContain("dégâts de brûlure subis");
		expect(poisonDescription).toContain("dégâts de poison subis");
		expect([fireDescription, frostDescription, poisonDescription].join()).not.toContain("%");
	});
});
