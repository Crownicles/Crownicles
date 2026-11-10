import {
	MersenneTwister19937, Random
} from "random-js";
import Player from "../../../database/game/models/Player";
import { PlayerActiveObjects } from "../../../database/game/models/PlayerActiveObjects";
import { ClassDataController } from "../../../../data/Class";
import { WeaponDataController } from "../../../../data/Weapon";
import { ArmorDataController } from "../../../../data/Armor";
import { PotionDataController } from "../../../../data/Potion";
import { ObjectItemDataController } from "../../../../data/ObjectItem";
import { PetDataController } from "../../../../data/Pet";
import { ItemDataController } from "../../../../data/DataController";
import { GenericItem } from "../../../../data/GenericItem";
import {
	KING_GUARD_PROFILES, KingGuardData, KingGuardPetData, KingGuardProfile
} from "../../../../data/KingGuard";
import {
	FightItemNatures, ItemCategory, ItemConstants, ItemRarity
} from "../../../../../../Lib/src/constants/ItemConstants";
import {
	EnchantmentSlot, ItemEnchantment, ItemEnchantmentKind
} from "../../../../../../Lib/src/types/ItemEnchantment";
import { FightConstants } from "../../../../../../Lib/src/constants/FightConstants";
import {
	SexTypeShort, StringConstants
} from "../../../../../../Lib/src/constants/StringConstants";
import {
	buildKingGuardActiveObjects, KingGuardEquipment
} from "../KingGuardLibrary";

type Range = {
	MIN: number;
	MAX: number;
};

type ProfileSettings = {

	// Number of guards of this profile among the guards of each level
	count: number;

	// Rarity of the items, relative to the rarity players commonly wear at the level of the guard
	rarityOffset: Range;

	// Upgrade level of the weapon and the armor, relative to the one players commonly reached at the level of the guard
	upgradeOffset: Range;
	enchantmentProbability: number;
	fightPotionProbability: number;

	// Objects boosting the attack, the defense or the speed only, instead of any object
	fightObjectOnly: boolean;

	// The items giving the most stats to the guard are kept instead of random ones, with the strongest enchantments
	bestItems: boolean;

	// Chance to have a pet, drawn among the pets sorted by force between these quantiles (0 the weakest, 1 the strongest)
	petProbability: number;
	petForceQuantile: Range;
};

/*
 * Profiles of the guards of each level, from the players who neglect their equipment to the ones who optimize everything.
 * The counts add up to FightConstants.KING_GUARD.LIBRARY.GUARDS_PER_LEVEL
 */
export const KING_GUARD_PROFILE_SETTINGS: Record<KingGuardProfile, ProfileSettings> = {
	[KING_GUARD_PROFILES.POORLY_EQUIPPED]: {
		count: 2,
		rarityOffset: {
			MIN: -3, MAX: -1
		},
		upgradeOffset: {
			MIN: -5, MAX: -3
		},
		enchantmentProbability: 0.05,
		fightPotionProbability: 0,
		fightObjectOnly: false,
		bestItems: false,
		petProbability: 0.5,
		petForceQuantile: {
			MIN: 0, MAX: 0.4
		}
	},
	[KING_GUARD_PROFILES.AVERAGE]: {
		count: 4,
		rarityOffset: {
			MIN: -1, MAX: 1
		},
		upgradeOffset: {
			MIN: -2, MAX: 0
		},
		enchantmentProbability: 0.4,
		fightPotionProbability: 0.2,
		fightObjectOnly: true,
		bestItems: false,
		petProbability: 0.85,
		petForceQuantile: {
			MIN: 0, MAX: 1
		}
	},
	[KING_GUARD_PROFILES.WELL_EQUIPPED]: {
		count: 3,
		rarityOffset: {
			MIN: 0, MAX: 1
		},
		upgradeOffset: {
			MIN: -1, MAX: 0
		},
		enchantmentProbability: 0.85,
		fightPotionProbability: 0.6,
		fightObjectOnly: true,
		bestItems: false,
		petProbability: 1,
		petForceQuantile: {
			MIN: 0.5, MAX: 1
		}
	},
	[KING_GUARD_PROFILES.OPTIMIZED]: {
		count: 1,
		rarityOffset: {
			MIN: 2, MAX: 2
		},
		upgradeOffset: {
			MIN: ItemConstants.MAX_UPGRADE_LEVEL, MAX: ItemConstants.MAX_UPGRADE_LEVEL
		},
		enchantmentProbability: 1,
		fightPotionProbability: 1,
		fightObjectOnly: true,
		bestItems: true,
		petProbability: 1,
		petForceQuantile: {
			MIN: 0.9, MAX: 1
		}
	}
};

// Calibrated on real players' equipment: about one rarity every 16 levels, starting from common
const EXPECTED_RARITY = {
	AT_LEVEL_ZERO: 1,
	LEVELS_PER_RARITY: 16
};

// Players reach the maximum upgrade level of their weapon and armor progressively, from the required fight level to this one
const FULLY_UPGRADED_LEVEL = 120;

// Number of best items among which an optimized guard picks each of its items, so that the optimized guards stay varied
const BEST_ITEMS_CHOICE = 3;

// Id of the empty item of each category (no potion, no object...)
const NO_ITEM_ID = 0;

// Seed of the library committed in Core/resources/kingGuards/library.json
export const KING_GUARD_LIBRARY_SEED = 5137;

type GuardSlot = Pick<KingGuardData, "id" | "level" | "sex" | "classId" | "profile">;

type EquipmentDraw = {
	equipment: KingGuardEquipment;
	rarity: number;
	potionNature: number | null;
};

function clamp(value: number, range: Range): number {
	return Math.min(range.MAX, Math.max(range.MIN, value));
}

/**
 * Rarity players commonly wear at a level
 * @param level
 */
function getExpectedRarity(level: number): number {
	return Math.round(EXPECTED_RARITY.AT_LEVEL_ZERO + level / EXPECTED_RARITY.LEVELS_PER_RARITY);
}

/**
 * Upgrade level players commonly reached at a level
 * @param level
 */
function getExpectedUpgradeLevel(level: number): number {
	const progression = (level - FightConstants.REQUIRED_LEVEL) / (FULLY_UPGRADED_LEVEL - FightConstants.REQUIRED_LEVEL);
	return Math.round(clamp(progression, {
		MIN: 0, MAX: 1
	}) * ItemConstants.MAX_UPGRADE_LEVEL);
}

/**
 * Draw an integer at a random offset from a base value, clamped in the given bounds
 */
function drawAround(random: Random, base: number, offset: Range, bounds: Range): number {
	return clamp(base + random.integer(offset.MIN, offset.MAX), bounds);
}

/**
 * Items of the highest rarity not above the given one that has some, the empty item excluded, ordered by id for reproducible draws
 */
function getItemsOfRarityOrBelow<T extends GenericItem>(controller: ItemDataController<T>, rarity: number, filter: (item: T) => boolean = (): boolean => true): T[] {
	for (let currentRarity = rarity; currentRarity >= ItemRarity.COMMON; currentRarity--) {
		const items = controller.getAllValues()
			.filter(item => item.id !== NO_ITEM_ID && item.rarity === currentRarity && filter(item))
			.sort((a, b) => a.id - b.id);
		if (items.length > 0) {
			return items;
		}
	}
	throw new Error(`No item found for rarity ${rarity} or below`);
}

/**
 * Enchantments a guard may get on a slot: any of them that applies against a player, only the strongest for an optimized guard
 */
function getEnchantmentPool(slot: EnchantmentSlot, strongestOnly: boolean): ItemEnchantment[] {
	const enchantments = ItemEnchantment.getAllEnchantments()
		.filter(enchantment => enchantment.kind.slot === slot && enchantment.kind !== ItemEnchantmentKind.PVE_ATTACK)
		.sort((a, b) => a.id.localeCompare(b.id));
	if (!strongestOnly) {
		return enchantments;
	}
	const strongestLevel = Math.max(...enchantments.map(enchantment => enchantment.level));
	return enchantments.filter(enchantment => enchantment.level === strongestLevel);
}

/**
 * Draw the enchantment of the weapon or the armor of a guard, with the same weights as the enchantments found in the game
 */
function drawEnchantment(random: Random, slot: EnchantmentSlot, settings: ProfileSettings): string | null {
	if (!random.bool(settings.enchantmentProbability)) {
		return null;
	}
	const pool = getEnchantmentPool(slot, settings.bestItems);
	let roll = random.real(0, pool.reduce((total, enchantment) => total + enchantment.probabilityWeight, 0));
	const enchantment = pool.find(candidate => {
		roll -= candidate.probabilityWeight;
		return roll < 0;
	}) ?? pool[pool.length - 1];
	return enchantment.id;
}

/**
 * Draw the equipment of a guard following its profile
 */
function drawEquipment(random: Random, slot: GuardSlot): EquipmentDraw {
	const settings = KING_GUARD_PROFILE_SETTINGS[slot.profile];
	const rarity = drawAround(random, getExpectedRarity(slot.level), settings.rarityOffset, {
		MIN: ItemRarity.COMMON, MAX: ItemRarity.MYTHICAL
	});
	const upgradeBounds = {
		MIN: 0, MAX: ItemConstants.MAX_UPGRADE_LEVEL
	};
	const potionNature = random.bool(settings.fightPotionProbability) ? random.pick(FightItemNatures) : null;
	return {
		rarity,
		potionNature,
		equipment: {
			weapon: {
				id: random.pick(getItemsOfRarityOrBelow(WeaponDataController.instance, rarity)).id,
				level: drawAround(random, getExpectedUpgradeLevel(slot.level), settings.upgradeOffset, upgradeBounds),
				enchantmentId: drawEnchantment(random, ItemCategory.WEAPON, settings)
			},
			armor: {
				id: random.pick(getItemsOfRarityOrBelow(ArmorDataController.instance, rarity)).id,
				level: drawAround(random, getExpectedUpgradeLevel(slot.level), settings.upgradeOffset, upgradeBounds),
				enchantmentId: drawEnchantment(random, ItemCategory.ARMOR, settings)
			},
			potionId: potionNature === null
				? NO_ITEM_ID
				: random.pick(getItemsOfRarityOrBelow(PotionDataController.instance, rarity, potion => potion.nature === potionNature)).id,
			objectId: random.pick(getItemsOfRarityOrBelow(
				ObjectItemDataController.instance,
				rarity,
				object => !settings.fightObjectOnly || FightItemNatures.includes(object.nature)
			)).id
		}
	};
}

/**
 * Pick one of the candidates giving the most stats to a guard
 */
function pickBestItem<T>(random: Random, guard: Player, candidates: {
	items: T[];
	equippedWith: (item: T) => PlayerActiveObjects;
}): T {
	const ranked = candidates.items
		.map(item => ({
			item,
			power: guard.getCumulativeAttack(candidates.equippedWith(item))
				+ guard.getCumulativeDefense(candidates.equippedWith(item))
				+ guard.getCumulativeSpeed(candidates.equippedWith(item))
		}))
		.sort((a, b) => b.power - a.power);
	return random.pick(ranked.slice(0, BEST_ITEMS_CHOICE)).item;
}

/**
 * Replace each item of an optimized guard, one after the other, by one of the items of its rarity giving it the most stats
 */
function optimizeEquipment(random: Random, slot: GuardSlot, draw: EquipmentDraw): KingGuardEquipment {
	const guard = Player.build({
		level: slot.level, class: slot.classId
	});
	const equipment = { ...draw.equipment };
	const equippedWith = (changes: Partial<KingGuardEquipment>): PlayerActiveObjects => buildKingGuardActiveObjects({
		...equipment, ...changes
	});

	equipment.weapon = {
		...equipment.weapon,
		id: pickBestItem(random, guard, {
			items: getItemsOfRarityOrBelow(WeaponDataController.instance, draw.rarity),
			equippedWith: weapon => equippedWith({
				weapon: {
					...equipment.weapon, id: weapon.id
				}
			})
		}).id
	};
	equipment.armor = {
		...equipment.armor,
		id: pickBestItem(random, guard, {
			items: getItemsOfRarityOrBelow(ArmorDataController.instance, draw.rarity),
			equippedWith: armor => equippedWith({
				armor: {
					...equipment.armor, id: armor.id
				}
			})
		}).id
	};
	equipment.objectId = pickBestItem(random, guard, {
		items: getItemsOfRarityOrBelow(ObjectItemDataController.instance, draw.rarity, object => FightItemNatures.includes(object.nature)),
		equippedWith: object => equippedWith({ objectId: object.id })
	}).id;
	if (draw.potionNature !== null) {
		equipment.potionId = pickBestItem(random, guard, {
			items: getItemsOfRarityOrBelow(PotionDataController.instance, draw.rarity, potion => FightItemNatures.includes(potion.nature)),
			equippedWith: potion => equippedWith({ potionId: potion.id })
		}).id;
	}
	return equipment;
}

/**
 * Draw the pet of a guard following its profile, or none
 */
function drawPet(random: Random, settings: ProfileSettings): KingGuardPetData | null {
	if (!random.bool(settings.petProbability)) {
		return null;
	}
	const pets = PetDataController.instance.getAllValues()
		.filter(pet => pet.rarity !== 0)
		.sort((a, b) => a.force - b.force || a.id - b.id);
	const first = Math.floor(settings.petForceQuantile.MIN * (pets.length - 1));
	const last = Math.ceil(settings.petForceQuantile.MAX * (pets.length - 1));
	return {
		typeId: random.pick(pets.slice(first, last + 1)).id,
		sex: random.bool() ? StringConstants.SEX.MALE.short : StringConstants.SEX.FEMALE.short
	};
}

/**
 * Spread the classes available at a level, the profiles and the sexes over the guards of this level
 */
function getGuardSlotsOfLevel(random: Random, level: number, firstId: number): GuardSlot[] {
	const guardsPerLevel = FightConstants.KING_GUARD.LIBRARY.GUARDS_PER_LEVEL;
	const classes = random.shuffle(ClassDataController.instance.getByGroup(Player.build({ level }).getClassGroup())
		.map(guardClass => guardClass.id)
		.sort((a, b) => a - b));
	const profiles = random.shuffle(Object.values(KING_GUARD_PROFILES)
		.flatMap(profile => Array.from({ length: KING_GUARD_PROFILE_SETTINGS[profile].count }, () => profile)));
	const sexes: SexTypeShort[] = random.shuffle(Array.from({ length: guardsPerLevel }, (_, index) =>
		index % 2 === 0 ? StringConstants.SEX.MALE.short : StringConstants.SEX.FEMALE.short));
	return Array.from({ length: guardsPerLevel }, (_, index) => ({
		id: firstId + index,
		level,
		sex: sexes[index],
		classId: classes[index % classes.length],
		profile: profiles[index]
	}));
}

/**
 * Generate the library of the king guards, without their initial rating (see KingGuardLibraryCalibration).
 * The same seed gives the same library as long as the game data does not change
 * @param seed
 */
export function generateKingGuardLibrary(seed = KING_GUARD_LIBRARY_SEED): Omit<KingGuardData, "initialGlory">[] {
	const random = new Random(MersenneTwister19937.seed(seed));
	const {
		MIN_LEVEL, MAX_LEVEL, GUARDS_PER_LEVEL
	} = FightConstants.KING_GUARD.LIBRARY;
	const guards: Omit<KingGuardData, "initialGlory">[] = [];
	for (let level = MIN_LEVEL; level <= MAX_LEVEL; level++) {
		for (const slot of getGuardSlotsOfLevel(random, level, (level - MIN_LEVEL) * GUARDS_PER_LEVEL + 1)) {
			const settings = KING_GUARD_PROFILE_SETTINGS[slot.profile];
			const draw = drawEquipment(random, slot);
			guards.push({
				...slot,
				...settings.bestItems ? optimizeEquipment(random, slot, draw) : draw.equipment,
				pet: drawPet(random, settings)
			});
		}
	}
	return guards;
}

/**
 * Guards to add to the library so that every level has its guards. A guard already in the library never changes: its rating,
 * its name and the logs of its fights are tied to its id. The new guards are taken from a generated library, level by level,
 * and get the ids following the highest one of the library
 * @param library - The guards already in the library
 * @param generated - A library generated by generateKingGuardLibrary
 */
export function completeKingGuardLibrary(
	library: Pick<KingGuardData, "id" | "level">[],
	generated: Omit<KingGuardData, "initialGlory">[]
): Omit<KingGuardData, "initialGlory">[] {
	let nextId = library.reduce((highest, guard) => Math.max(highest, guard.id), 0) + 1;
	const newGuards: Omit<KingGuardData, "initialGlory">[] = [];
	for (const level of [...new Set(generated.map(guard => guard.level))]) {
		const guardsInLibrary = library.filter(guard => guard.level === level).length;
		for (const guard of generated.filter(generatedGuard => generatedGuard.level === level).slice(guardsInLibrary)) {
			newGuards.push({
				...guard,
				id: nextId++
			});
		}
	}
	return newGuards;
}
