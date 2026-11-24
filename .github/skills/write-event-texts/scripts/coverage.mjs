/**
 * Coverage of a possibility: every player profile must have at least one valid outcome
 */
import {
	byNumber, get, getOrEmpty, inRange, need, truthy
} from "./python.mjs";

/**
 * Requirements of each outcome, the consumed materials counting as a material requirement
 * @param {any[]} outs
 * @returns {object[]}
 */
function coverageRequirements(outs) {
	return outs.map(x => {
		const requirements = truthy(get(x, "requirements")) ? { ...x.requirements } : {};
		if (Object.hasOwn(x, "consumeMaterials")) {
			const filters = Array.isArray(x.consumeMaterials) ? x.consumeMaterials : [x.consumeMaterials];
			requirements.materials = { quantity: { min: filters.reduce((sum, filter) => sum + need(filter, "quantity"), 0) } };
		}
		return requirements;
	});
}

/**
 * Values to try for a range requirement: the defaults, and each bound with its neighbours
 * @param {object[]} reqs
 * @param {string} key
 * @param {number[]} defaults
 * @returns {number[]}
 */
function boundaryValues(reqs, key, defaults) {
	const found = new Set(defaults);
	const bounds = reqs.flatMap(r => {
		const range = getOrEmpty(r, key);
		return [get(range, "min"), get(range, "max")];
	}).filter(value => value !== null);
	for (const value of bounds) {
		found.add(value).add(value - 1)
			.add(value + 1);
	}
	return [...found].sort(byNumber);
}

/**
 * Profiles of the dimensions to try: each key with the values to try
 * @param {object[]} reqs
 * @param {Map<number, {rarity: number, tags: string[]}>} pets
 * @returns {[string, unknown[]][]}
 */
function coverageDimensions(reqs, pets) {
	// Pets listed by id, and every pet carrying a tag an outcome asks for
	const askedTags = new Set(reqs.flatMap(r => get(r, "petTags", [])));
	const taggedPets = [...pets].filter(([, pet]) => pet.tags.some(tag => askedTags.has(tag))).map(([id]) => id);
	const listedPets = [...new Set([...reqs.flatMap(r => get(r, "validPetTypeIds", [])), ...taggedPets])].sort(byNumber);
	const petProfiles = [
		null,
		...listedPets.filter(id => pets.has(id)).map(id => [id, pets.get(id).rarity]),
		...boundaryValues(reqs, "petRarity", [1, 8]).filter(rarity => rarity >= 1 && rarity <= 8)
			.map(rarity => [-1, rarity])
	];
	const uses = key => reqs.some(r => Object.hasOwn(r, key));
	const optionalLevel = (key, defaults) => (uses(key) ? boundaryValues(reqs, key, defaults) : [0]);

	// Extra dimensions only vary when an outcome uses them; materials and enchantment: the player has none, or has everything
	return [
		["level", boundaryValues(reqs, "level", [1, 200])],
		["karma", boundaryValues(reqs, "karma", [-500, 0, 500])],
		["health", boundaryValues(reqs, "health", [1, 1000])],
		["attack", boundaryValues(reqs, "attack", [0, 2000])],
		["defense", boundaryValues(reqs, "defense", [0, 2000])],
		["speed", boundaryValues(reqs, "speed", [0, 2000])],
		["money", boundaryValues(reqs, "money", [0, 10 ** 7])],
		["class", [...new Set([...reqs.flatMap(r => get(r, "validClassIds", [])), 0])].sort(byNumber)],
		["pet", petProfiles],
		["cooking", optionalLevel("cookingLevel", [0, 100])],
		["weaponLevel", optionalLevel("weaponLevel", [0, 10])],
		["armorLevel", optionalLevel("armorLevel", [0, 10])],
		["energyPercent", uses("energyPercent") ? boundaryValues(reqs, "energyPercent", [0, 100]).filter(value => value >= 0 && value <= 100) : [100]],
		["hasMaterials", uses("materials") ? [false, true] : [true]],
		["hasEnchantment", uses("enchantment") ? [false, true] : [true]],
		["hasWeaponTags", uses("weaponTags") ? [false, true] : [true]],
		["hasBadges", uses("badges") ? [false, true] : [true]]
	];
}

/**
 * Whether the equipment and cooking requirements accept the profile
 * @param {object} r requirements
 * @param {object} profile
 * @returns {boolean}
 */
function areLevelsCovered(r, profile) {
	return [["cookingLevel", profile.cooking], ["weaponLevel", profile.weaponLevel], ["armorLevel", profile.armorLevel], ["energyPercent", profile.energyPercent]]
		.every(([key, value]) => inRange(get(r, key), Math.max(value, 0)));
}

/**
 * Whether the material and enchantment requirements accept the profile
 * @param {object} r requirements
 * @param {object} profile
 * @returns {boolean}
 */
function areBelongingsCovered(r, profile) {
	if (Object.hasOwn(r, "materials")) {
		const quantity = get(r.materials, "quantity");
		if (!inRange(truthy(quantity) ? quantity : { min: 1 }, profile.hasMaterials ? 10 ** 6 : 0)) {
			return false;
		}
	}
	return (!Object.hasOwn(r, "enchantment") || profile.hasEnchantment)
		&& (!Object.hasOwn(r, "weaponTags") || profile.hasWeaponTags)
		&& (!Object.hasOwn(r, "badges") || profile.hasBadges);
}

/**
 * Whether the level, karma, health and fight stat requirements accept the profile
 * @param {object} r requirements
 * @param {object} profile
 * @returns {boolean}
 */
function areStatsCovered(r, profile) {
	return ["level", "karma", "health", "attack", "defense", "speed", "money"].every(key => inRange(get(r, key), profile[key]));
}

/**
 * Whether the class requirement accepts the class of the profile
 * @param {object} r requirements
 * @param {number} cls
 * @returns {boolean}
 */
function isClassCovered(r, cls) {
	return !Object.hasOwn(r, "validClassIds") || r.validClassIds.includes(cls);
}

/**
 * Whether the pet type requirement accepts the pet of the profile
 * @param {object} r requirements
 * @param {[number, number] | null} pet type and rarity, null without pet
 * @returns {boolean}
 */
function isPetTypeCovered(r, pet) {
	if (!Object.hasOwn(r, "validPetTypeIds")) {
		return true;
	}
	return pet !== null && r.validPetTypeIds.includes(pet[0]);
}

/**
 * Whether the pet tag requirement accepts the pet of the profile (a pet known only by its rarity has no tag)
 * @param {object} r requirements
 * @param {[number, number] | null} pet type and rarity, null without pet
 * @param {Map<number, {tags: string[]}>} pets
 * @returns {boolean}
 */
function isPetTagCovered(r, pet, pets) {
	if (!Object.hasOwn(r, "petTags")) {
		return true;
	}
	const tags = pet === null ? [] : pets.get(pet[0])?.tags ?? [];
	return r.petTags.some(tag => tags.includes(tag));
}

/**
 * Whether the pet rarity requirement accepts the pet of the profile
 * @param {object} r requirements
 * @param {[number, number] | null} pet type and rarity, null without pet
 * @returns {boolean}
 */
function isPetRarityCovered(r, pet) {
	if (!Object.hasOwn(r, "petRarity")) {
		return true;
	}
	return pet !== null && inRange(r.petRarity, pet[1]);
}

/**
 * Whether an outcome with these requirements is valid for the profile
 * @param {object} r requirements
 * @param {object} profile
 * @param {Map<number, {tags: string[]}>} pets
 * @returns {boolean}
 */
function isProfileCovered(r, profile, pets) {
	return areLevelsCovered(r, profile)
		&& areBelongingsCovered(r, profile)
		&& areStatsCovered(r, profile)
		&& isClassCovered(r, profile.class)
		&& isPetTypeCovered(r, profile.pet)
		&& isPetRarityCovered(r, profile.pet)
		&& isPetTagCovered(r, profile.pet, pets)
		&& !Object.hasOwn(r, "campaignCurrentMissionId");
}

/**
 * Error describing a profile no outcome covers
 * @param {string} name possibility
 * @param {object} profile
 * @returns {string}
 */
function uncoveredProfileError(name, profile) {
	const { pet } = profile;
	return `${name}: no valid outcome for level=${profile.level} karma=${profile.karma} health=${profile.health} attack=${profile.attack} defense=${profile.defense} speed=${profile.speed} money=${profile.money} class=${profile.class} pet=${pet === null ? "None" : `(${pet[0]}, ${pet[1]})`}`
		+ ` cooking=${profile.cooking} weaponLevel=${profile.weaponLevel} armorLevel=${profile.armorLevel} energy=${profile.energyPercent}% materials=${profile.hasMaterials ? "oui" : "aucun"} enchantment=${profile.hasEnchantment ? "oui" : "aucun"}`;
}

/**
 * Every profile of the cartesian product of the dimensions, the last one varying fastest (itertools.product)
 * @param {[string, unknown[]][]} dims
 * @returns {Generator<object>}
 */
function* profilesOf(dims) {
	const indexes = dims.map(() => 0);
	for (;;) {
		yield Object.fromEntries(dims.map(([key, values], i) => [key, values[indexes[i]]]));
		let i = dims.length - 1;
		while (i >= 0 && ++indexes[i] === dims[i][1].length) {
			indexes[i--] = 0;
		}
		if (i < 0) {
			return;
		}
	}
}

/**
 * Coverage: every player profile must have at least one valid outcome of the possibility
 * @param {string} name possibility
 * @param {any[]} outs outcomes of the possibility
 * @param {Map<number, {rarity: number, tags: string[]}>} pets
 * @returns {string | null} the error for the first uncovered profile
 */
export function checkCoverage(name, outs, pets) {
	const reqs = coverageRequirements(outs);
	if (outs.length === 0) {
		return null;
	}
	for (const profile of profilesOf(coverageDimensions(reqs, pets))) {
		if (!reqs.some(r => isProfileCovered(r, profile, pets))) {
			return uncoveredProfileError(name, profile);
		}
	}
	return null;
}

/**
 * Dimensions of the most common player: karma 0 (karma is not in production yet), no pet, no class, cooking, badge,
 * enchantment or upgrade condition met, average money, full health and energy; only the level and fight stats vary
 * @param {object[]} reqs
 * @param {Map<number, {rarity: number, tags: string[]}>} pets
 * @returns {[string, unknown[]][]}
 */
function commonPlayerDimensions(reqs, pets) {
	const fixed = {
		karma: [0],
		health: [1000],
		money: [20_000],
		class: [0],
		pet: [null],
		cooking: [0],
		weaponLevel: [0],
		armorLevel: [0],
		energyPercent: [100],
		hasMaterials: [true],
		hasEnchantment: [false],
		hasWeaponTags: [false],
		hasBadges: [false]
	};
	return coverageDimensions(reqs, pets).map(([key, values]) => [key, fixed[key] ?? values]);
}

/**
 * Monotony: the most common player must not always get the same outcome of a possibility
 * @param {string} name possibility
 * @param {[string, any][]} outs outcomes of the possibility, with their ids
 * @param {Map<number, {rarity: number, tags: string[]}>} pets
 * @returns {string | null} the warning for the first common profile with a single valid outcome
 */
export function checkMonotony(name, outs, pets) {
	const reqs = coverageRequirements(outs.map(([, x]) => x));
	for (const profile of profilesOf(commonPlayerDimensions(reqs, pets))) {
		const valid = outs.filter((_, i) => isProfileCovered(reqs[i], profile, pets));
		if (valid.length === 1) {
			return `${name}: a karma 0 player without pet always gets the outcome ${valid[0][0]} (level=${profile.level} attack=${profile.attack} defense=${profile.defense} speed=${profile.speed}); add an outcome without condition`;
		}
	}
	return null;
}
