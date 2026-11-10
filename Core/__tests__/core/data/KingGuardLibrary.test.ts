import {
	describe, expect, it
} from "vitest";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { Sequelize } from "sequelize";
import {
	KING_GUARD_PROFILES, KingGuardDataController
} from "../../../src/data/KingGuard";
import { KING_GUARD_PROFILE_SETTINGS } from "../../../src/core/fights/kingGuards/library/KingGuardLibraryGenerator";
import Player, { initModel as initPlayer } from "../../../src/core/database/game/models/Player";
import { ClassDataController } from "../../../src/data/Class";
import { WeaponDataController } from "../../../src/data/Weapon";
import { ArmorDataController } from "../../../src/data/Armor";
import { PotionDataController } from "../../../src/data/Potion";
import { ObjectItemDataController } from "../../../src/data/ObjectItem";
import { PetDataController } from "../../../src/data/Pet";
import { FightConstants } from "../../../../Lib/src/constants/FightConstants";
import {
	FightItemNatures, ItemCategory, ItemConstants
} from "../../../../Lib/src/constants/ItemConstants";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { StringConstants } from "../../../../Lib/src/constants/StringConstants";

const guards = KingGuardDataController.instance.getAll();
const names = (JSON.parse(readFileSync("../Lang/fr/kingGuards.json", "utf8")) as { names: Record<string, string> }).names;
const {
	MIN_LEVEL, MAX_LEVEL, GUARDS_PER_LEVEL
} = FightConstants.KING_GUARD.LIBRARY;
const levels = Array.from({ length: MAX_LEVEL - MIN_LEVEL + 1 }, (_, index) => MIN_LEVEL + index);

// Guards of the library as first released, with their names
const FIRST_LIBRARY = {
	SIZE: 1710,
	SHA256: "9b1de711624987fff9b82450bdf2b3b56621553d2c16f20ba86767a531a127bd"
};

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
}

describe("King guards library", () => {
	it("has the same number of guards at every level of the library, with ids following the levels", () => {
		expect(guards).toHaveLength(levels.length * GUARDS_PER_LEVEL);
		expect(guards.map(guard => guard.id)).toEqual(Array.from({ length: guards.length }, (_, index) => index + 1));
		for (const level of levels) {
			expect(KingGuardDataController.instance.getOfClosestLevel(level).map(guard => guard.level)).toEqual(Array(GUARDS_PER_LEVEL).fill(level));
		}
	});

	it("spreads the profiles and the sexes of the guards of each level evenly", () => {
		expect(Object.values(KING_GUARD_PROFILE_SETTINGS).reduce((total, settings) => total + settings.count, 0)).toBe(GUARDS_PER_LEVEL);
		for (const level of levels) {
			const guardsOfLevel = KingGuardDataController.instance.getOfClosestLevel(level);
			for (const profile of Object.values(KING_GUARD_PROFILES)) {
				expect(guardsOfLevel.filter(guard => guard.profile === profile)).toHaveLength(KING_GUARD_PROFILE_SETTINGS[profile].count);
			}
			expect(guardsOfLevel.filter(guard => guard.sex === StringConstants.SEX.FEMALE.short)).toHaveLength(GUARDS_PER_LEVEL / 2);
			expect(guardsOfLevel.filter(guard => guard.sex === StringConstants.SEX.MALE.short)).toHaveLength(GUARDS_PER_LEVEL / 2);
		}
	});

	it("gives every guard a class available at its level", () => {
		initPlayer(new Sequelize({
			dialect: "mariadb", logging: false
		}));
		for (const guard of guards) {
			const guardClass = ClassDataController.instance.getById(guard.classId);
			expect(guardClass, `guard ${guard.id}`).toBeDefined();
			expect(guardClass!.classGroup, `guard ${guard.id}`).toBe(Player.build({ level: guard.level }).getClassGroup());
		}
	});

	it("equips every guard with an existing weapon and armor, upgraded and enchanted within the rules", () => {
		for (const guard of guards) {
			for (const [slot, controller, category] of [
				[guard.weapon, WeaponDataController.instance, ItemCategory.WEAPON],
				[guard.armor, ArmorDataController.instance, ItemCategory.ARMOR]
			] as const) {
				expect(slot.id, `guard ${guard.id}`).not.toBe(0);
				expect(controller.getById(slot.id), `guard ${guard.id}`).toBeDefined();
				expect(slot.level).toBeGreaterThanOrEqual(0);
				expect(slot.level).toBeLessThanOrEqual(ItemConstants.MAX_UPGRADE_LEVEL);
				if (slot.enchantmentId !== null) {
					expect(ItemEnchantment.getById(slot.enchantmentId)?.kind.slot, `guard ${guard.id}`).toBe(category);
				}
			}
		}
	});

	it("gives every guard a fight potion or none, an existing object and an existing pet or none", () => {
		for (const guard of guards) {
			const potion = PotionDataController.instance.getById(guard.potionId);
			expect(potion, `guard ${guard.id}`).toBeDefined();
			if (guard.potionId !== 0) {
				expect(FightItemNatures, `guard ${guard.id}`).toContain(potion!.nature);
			}
			expect(ObjectItemDataController.instance.getById(guard.objectId), `guard ${guard.id}`).toBeDefined();
			if (guard.pet) {
				expect(PetDataController.instance.getById(guard.pet.typeId), `guard ${guard.id}`).toBeDefined();
			}
		}
	});

	it("rates every guard, the guards getting stronger with the level and the optimized ones stronger than the poorly equipped ones", () => {
		expect(guards.every(guard => Number.isInteger(guard.initialGlory))).toBe(true);
		const lowestLevels = guards.filter(guard => guard.level < MIN_LEVEL + 10);
		const highestLevels = guards.filter(guard => guard.level > MAX_LEVEL - 10);
		expect(median(highestLevels.map(guard => guard.initialGlory))).toBeGreaterThan(median(lowestLevels.map(guard => guard.initialGlory)));
		const medianOfProfile = (profile: string): number => median(guards.filter(guard => guard.profile === profile).map(guard => guard.initialGlory));
		expect(medianOfProfile(KING_GUARD_PROFILES.OPTIMIZED)).toBeGreaterThan(medianOfProfile(KING_GUARD_PROFILES.POORLY_EQUIPPED));
	});

	it("names every guard with a first name no other guard has", () => {
		expect(Object.keys(names).map(Number)
			.sort((a, b) => a - b)).toEqual(guards.map(guard => guard.id));
		const normalizedNames = Object.values(names).map(name => name.normalize("NFD")
			.replace(/\p{M}/gu, "")
			.toLowerCase());
		expect(new Set(normalizedNames).size).toBe(normalizedNames.length);
		expect(Object.values(names).every(name => (/^\p{Lu}[\p{L}]+$/u).test(name))).toBe(true);
	});

	/*
	 * The rating of a guard, its name and the logs of its fights are tied to its id: a guard of the library must never be changed
	 * nor removed (its id could be given again to a new guard). New guards are added after them by `pnpm generateKingGuardLibrary`
	 */
	it("never changes nor removes the guards of the first library, nor their names", () => {
		const firstLibrary = guards.filter(guard => guard.id <= FIRST_LIBRARY.SIZE);

		expect(firstLibrary).toHaveLength(FIRST_LIBRARY.SIZE);
		expect(createHash("sha256").update(JSON.stringify(firstLibrary.map(guard => [guard, names[guard.id]])))
			.digest("hex")).toBe(FIRST_LIBRARY.SHA256);
	});
});
