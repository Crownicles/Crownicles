/**
 * Validate a rewritten event: <work>/out/<id>.json against <work>/input/<id>.json.
 *
 * Usage:
 *   node validate.mjs <event id> [--work <dir>]
 *
 * Prints "<n> outcomes, <m> conditional", then the errors and the warnings. Exits with 1 when there is an error.
 * Pets (id, rarity) and materials (id) come from Core/resources of the repository.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import {
	entriesOf, isObject, keysOf, readJson, REPO_ROOT, workDirectory
} from "./common.mjs";
import {
	byCodePoint, difference, get, getOrEmpty, need, pyEqual, pyInt, pyRepr, pyStr, truthy
} from "./python.mjs";
import {
	checkCoverage, checkMonotony
} from "./coverage.mjs";
import { checkTexts } from "./texts.mjs";
import { checkConsistency } from "./consistency.mjs";

/** @typedef {import("./texts.mjs").Report} Report */

const OUTCOME_KEYS = new Set([
	"condition", "requirements", "lostTime", "health", "karma", "effect", "money", "energy", "gems", "tokens", "bonusExperience",
	"bonusPoints", "randomItem", "randomPet", "givePet", "oneshot", "nextEvent", "mapTypesDestination", "mapTypesExcludeDestination",
	"mapLink", "goBackToPreviousMap", "forceStayInCity", "forceLeaveCity", "tags", "consumeMaterials", "giveMaterials", "fight", "useBed"
]);
const FIGHT_CONSEQUENCE_KEYS = new Set(["money", "health", "experience", "effect", "lostTime", "randomItem"]);
const REQ_RANGES = ["level", "karma", "health", "attack", "defense", "speed", "energyPercent", "money", "petRarity", "cookingLevel", "weaponLevel", "armorLevel"];
const REQ_LISTS = ["validClassIds", "validPetTypeIds", "excludedPetTypeIds", "petTags", "weaponTags", "badges"];
const REQ_KEYS = new Set([...REQ_RANGES, ...REQ_LISTS, "campaignCurrentMissionId", "materials", "enchantment"]);
const MATERIAL_FILTERS = new Set(["type", "rarity", "ids", "quantity"]);
const MATERIAL_TYPES = new Set(["metal", "alloy", "nature", "spiritual", "magic", "leather", "rope", "poison", "explosive", "wood"]);
const ENCHANT_TYPES = new Set(["damage", "health", "defense", "speed", "magic", "other"]);
const ENCHANT_KINDS = new Set([
	"pvpAttack", "pveAttack", "allAttack", "defense", "speed", "maxEnergy", "baseBreath", "maxBreath", "burnedDamage", "frozenDamage", "poisonedDamage"
]);
const ENCHANT_FILTERS = new Set(["slot", "types", "kinds", "level"]);
const EFFECTS = new Set([
	"occupied", "sleeping", "drunk", "freezing", "feetHurt", "hurt", "sick", "jailed", "injured", "starving", "confounded", "scared",
	"lost", "fished", "working", "burning"
]);
/**
 * Pets of the game: id -> { name, rarity, tags } (pet 0 is "no pet")
 * @returns {Map<number, {name: string, rarity: number, tags: string[]}>}
 */
function loadPets() {
	const names = readJson(join(REPO_ROOT, "Lang/fr/models.json")).pets;
	const directory = join(REPO_ROOT, "Core/resources/pets");
	return new Map(readdirSync(directory).filter(file => file.endsWith(".json"))
		.map(file => {
			const id = Number(basename(file, ".json"));
			const { rarity, tags } = readJson(join(directory, file));
			return [id, { name: names[`${id}_male`], rarity, tags: tags ?? [] }];
		}));
}

/**
 * Badges an event outcome may depend on, read from EVENT_OUTCOME_BADGES in Lib/src/types/Badge.ts
 * @returns {Set<string>}
 */
function loadEventBadges() {
	const source = readFileSync(join(REPO_ROOT, "Lib/src/types/Badge.ts"), "utf8");
	const values = new Map([...source.matchAll(/(\w+) = "(\w+)"/gu)].map(([, key, value]) => [key, value]));
	const list = source.match(/EVENT_OUTCOME_BADGES = \[([^\]]*)\]/u)?.[1] ?? "";
	return new Set([...list.matchAll(/Badge\.(\w+)/gu)].map(([, key]) => values.get(key)));
}

/**
 * Tags carried by at least one weapon of the game
 * @returns {Set<string>}
 */
function loadWeaponTags() {
	const directory = join(REPO_ROOT, "Core/resources/weapons");
	return new Set(readdirSync(directory).filter(file => file.endsWith(".json"))
		.flatMap(file => readJson(join(directory, file)).tags ?? []));
}

/**
 * Ids of the monsters of the game
 * @returns {Set<string>}
 */
function loadMonsters() {
	return new Set(readdirSync(join(REPO_ROOT, "Core/resources/monsters")).filter(file => file.endsWith(".json"))
		.map(file => basename(file, ".json")));
}

/**
 * Materials of the game: id -> { name, type, rarity }
 * @returns {Map<string, {name: string, type: string, rarity: number}>}
 */
function loadMaterials() {
	const names = readJson(join(REPO_ROOT, "Lang/fr/models.json")).materials;
	const directory = join(REPO_ROOT, "Core/resources/materials");
	return new Map(readdirSync(directory).filter(file => file.endsWith(".json"))
		.map(file => {
			const id = basename(file, ".json");
			const { type, rarity } = readJson(join(directory, file));
			return [id, { name: names[id], type, rarity }];
		}));
}

/**
 * Collected problems of an event: errors block the rewrite, warnings are advice
 * @typedef {{errors: string[], warnings: string[]}} Report
 */

/**
 * Check a material filter: known keys, type and ids
 * @param {Report} report
 * @param {string} path
 * @param {object} filter
 * @param {Map<string, unknown>} materials
 */
function checkMaterialFilter(report, path, filter, materials) {
	const unknown = difference(keysOf(filter), MATERIAL_FILTERS);
	if (unknown.size > 0) {
		report.errors.push(`${path}: unknown filter ${pyRepr(unknown)}`);
	}
	if (Object.hasOwn(filter, "type") && !MATERIAL_TYPES.has(filter.type)) {
		report.errors.push(`${path}: unknown material type ${pyStr(filter.type)}`);
	}
	for (const id of get(filter, "ids", []).filter(materialId => !materials.has(pyStr(materialId)))) {
		report.errors.push(`${path}: unknown material ${pyStr(id)}`);
	}
}

/**
 * Whether a material quantity is a positive integer (Python's True counts as 1)
 * @param {unknown} quantity
 * @returns {boolean}
 */
function isPositiveQuantity(quantity) {
	if (quantity === true) {
		return true;
	}
	return Number.isInteger(quantity) && quantity > 0;
}

/**
 * Check the materials an outcome consumes or gives
 * @param {Report} report
 * @param {string} path
 * @param {any} x outcome data
 * @param {Map<string, unknown>} materials
 */
function checkOutcomeMaterials(report, path, x, materials) {
	for (const field of ["consumeMaterials", "giveMaterials"].filter(key => Object.hasOwn(x, key))) {
		// Only consumeMaterials may list several filters (wood and metal, for instance)
		const filters = field === "consumeMaterials" && Array.isArray(x[field]) ? x[field] : [x[field]];
		for (const filter of filters) {
			checkMaterialFilter(report, `${path}.${field}`, filter, materials);
			if (!isPositiveQuantity(get(filter, "quantity"))) {
				report.errors.push(`${path}.${field}: quantity must be a positive integer`);
			}
		}
	}
}

/**
 * Whether a requirement range is malformed: not an object, or min above max
 * @param {unknown} range
 * @returns {boolean}
 */
function isBadRange(range) {
	if (!isObject(range)) {
		return true;
	}
	const hasBothBounds = get(range, "min") !== null && get(range, "max") !== null;
	return hasBothBounds && range.min > range.max;
}

/**
 * Whether a value is a list with at least one element
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonEmptyList(value) {
	return Array.isArray(value) && value.length > 0;
}

/**
 * Check the enchantment requirement: known filters, slot, types and kinds
 * @param {Report} report
 * @param {string} path
 * @param {object} enchantment
 */
function checkEnchantmentRequirement(report, path, enchantment) {
	const unknown = difference(keysOf(enchantment), ENCHANT_FILTERS);
	if (unknown.size > 0) {
		report.errors.push(`${path}: unknown enchantment filter ${pyRepr(unknown)}`);
	}
	if (![null, "weapon", "armor"].includes(get(enchantment, "slot"))) {
		report.errors.push(`${path}: enchantment slot must be weapon or armor`);
	}
	for (const type of difference(get(enchantment, "types", []), ENCHANT_TYPES)) {
		report.errors.push(`${path}: unknown enchantment type ${pyStr(type)}`);
	}
	for (const kind of difference(get(enchantment, "kinds", []), ENCHANT_KINDS)) {
		report.errors.push(`${path}: unknown enchantment kind ${pyStr(kind)}`);
	}
}

/**
 * Check the shape of the requirements: known keys, valid ranges and non-empty lists
 * @param {Report} report
 * @param {string} path
 * @param {object} req
 */
function checkRequirementShapes(report, path, req) {
	for (const key of difference(keysOf(req), REQ_KEYS)) {
		report.errors.push(`${path}: unknown requirement ${key}`);
	}
	for (const key of REQ_RANGES.filter(rangeKey => get(req, rangeKey) !== null && isBadRange(req[rangeKey]))) {
		report.errors.push(`${path}: bad range for ${key}`);
	}
	for (const key of REQ_LISTS.filter(listKey => Object.hasOwn(req, listKey) && !isNonEmptyList(req[listKey]))) {
		report.errors.push(`${path}: ${key} must be a non-empty list`);
	}
}

/**
 * Check that the pets, materials and enchantments the requirements name exist in the game
 * @param {Report} report
 * @param {string} path
 * @param {object} req
 * @param {{pets: Map<number, {tags: string[]}>, materials: Map<string, unknown>}} game
 */
function checkRequirementReferences(report, path, req, game) {
	const isUnknownPet = petId => !game.pets.has(typeof petId === "boolean" ? Number(petId) : petId);
	for (const petId of [...get(req, "validPetTypeIds", []), ...get(req, "excludedPetTypeIds", [])].filter(isUnknownPet)) {
		report.errors.push(`${path}: unknown pet ${pyStr(petId)}`);
	}
	for (const badge of get(req, "badges", []).filter(eventBadge => !game.eventBadges.has(eventBadge))) {
		report.errors.push(`${path}: ${pyStr(badge)} is not an event outcome badge (EVENT_OUTCOME_BADGES)`);
	}
	for (const tag of get(req, "weaponTags", []).filter(weaponTag => !game.weaponTags.has(weaponTag))) {
		report.errors.push(`${path}: no weapon has the tag ${pyStr(tag)}`);
	}
	const carriedTags = new Set([...game.pets.values()].flatMap(pet => pet.tags));
	for (const tag of get(req, "petTags", []).filter(petTag => !carriedTags.has(petTag))) {
		report.errors.push(`${path}: no pet has the tag ${pyStr(tag)}`);
	}
	const materialFilter = get(req, "materials");
	if (materialFilter !== null) {
		checkMaterialFilter(report, `${path}.requirements.materials`, materialFilter, game.materials);
	}
	const enchantment = get(req, "enchantment");
	if (enchantment !== null) {
		checkEnchantmentRequirement(report, path, enchantment);
	}
}

/**
 * Check the keys and the effect of an outcome
 * @param {Report} report
 * @param {string} path
 * @param {any} x outcome data
 */
function checkOutcomeKeys(report, path, x) {
	for (const key of difference(keysOf(x), OUTCOME_KEYS)) {
		report.errors.push(`${path}: unknown key ${key}`);
	}
	if (Object.hasOwn(x, "effect") && !EFFECTS.has(x.effect)) {
		report.errors.push(`${path}: unknown effect ${pyStr(x.effect)}`);
	}
	if (get(x, "effect") === "occupied" && !truthy(get(x, "lostTime"))) {
		report.warnings.push(`${path}: occupied without lostTime`);
	}
}

/**
 * Check where an outcome sends the player: city stay only in a city, destination among the neighbours
 * @param {Report} report
 * @param {string} path
 * @param {any} x outcome data
 * @param {{inp: any, neighbourTypes: Set<string>}} context
 */
function checkOutcomeTravel(report, path, x, context) {
	const changesCityStay = truthy(get(x, "forceStayInCity")) || truthy(get(x, "forceLeaveCity"));
	if (changesCityStay && !truthy(need(context.inp, "isCity"))) {
		report.errors.push(`${path}: forceStayInCity/forceLeaveCity outside a city`);
	}
	const destinations = get(x, "mapTypesDestination");
	if (truthy(destinations) && !Array.from(destinations).some(type => context.neighbourTypes.has(type))) {
		report.errors.push(`${path}: no neighbour of type ${pyStr(destinations)}`);
	}
}

/**
 * Check the mechanics of an outcome: keys, effect, city and destination constraints, materials, requirements
 * @param {Report} report
 * @param {string} path
 * @param {any} x outcome data
 * @param {{inp: any, neighbourTypes: Set<string>, pets: Map<number, unknown>, materials: Map<string, unknown>}} context
 * @returns {boolean} whether the outcome is conditional
 */
function checkOutcome(report, path, x, context) {
	checkOutcomeKeys(report, path, x);
	checkOutcomeTravel(report, path, x, context);
	checkOutcomeMaterials(report, path, x, context.materials);
	if (Object.hasOwn(x, "useBed") && (x.useBed !== true || get(x, "effect") !== "sleeping")) {
		report.errors.push(`${path}: useBed must be true and go with the sleeping effect (the player sleeps in a bed)`);
	}
	const req = getOrEmpty(x, "requirements");
	if (truthy(req)) {
		checkRequirementShapes(report, path, req);
		checkRequirementReferences(report, path, req, context);
	}
	return isConditional(x);
}

/**
 * Whether an outcome is reserved to some players. Excluding the pets of the species the outcome eats keeps it the general case
 * @param {any} x outcome data
 * @returns {boolean}
 */
function isConditional(x) {
	const req = getOrEmpty(x, "requirements");
	return keysOf(req).some(key => key !== "excludedPetTypeIds" && truthy(req[key])) || Object.hasOwn(x, "consumeMaterials") || x.useBed === true;
}

/**
 * Check the fight an outcome triggers: known monster, fixed level, energy condition and texts after the fight
 * @param {Report} report
 * @param {string} path
 * @param {any} x outcome data
 * @param {any} texts the won and lost texts of the outcome (possibility.fights.<outcome>)
 * @param {Set<string>} monsters
 */
function checkOutcomeFight(report, path, x, texts, monsters) {
	const fight = get(x, "fight");
	if (fight === null) {
		if (texts !== null) {
			report.errors.push(`${path}: texts after a fight, but the outcome triggers no fight`);
		}
		return;
	}
	if (!monsters.has(get(fight, "monster"))) {
		report.errors.push(`${path}: unknown monster ${pyStr(get(fight, "monster"))}`);
	}
	if (!Number.isInteger(get(fight, "level")) || fight.level < 1) {
		report.errors.push(`${path}: the fight needs a fixed level (positive integer)`);
	}
	for (const key of ["won", "lost"].flatMap(side => keysOf(getOrEmpty(fight, side)))) {
		if (!FIGHT_CONSEQUENCE_KEYS.has(key)) {
			report.errors.push(`${path}: unknown fight consequence ${key}`);
		}
	}
	if (!(get(get(getOrEmpty(x, "requirements"), "energyPercent", {}), "min", 0) >= 1)) {
		report.errors.push(`${path}: a fight needs requirements.energyPercent.min (a player without energy cannot fight)`);
	}
	if (typeof get(texts ?? {}, "won") !== "string" || typeof get(texts ?? {}, "lost") !== "string") {
		report.errors.push(`${path}: a fight needs the texts fights.<outcome>.won and .lost`);
	}
}

const STANDARD_TIER_BOUNDS = {
	attack: [230, 231, 599, 600],
	defense: [180, 181, 519, 520],
	speed: [40, 41, 349, 350]
};

/**
 * Warn when every stat check of the event uses the standard tiers: the difficulty must change from an event to another
 * @param {Report} report
 * @param {any} dp data possibilities
 */
function checkTierVariety(report, dp) {
	const bounds = entriesOf(dp).flatMap(([, possibility]) => entriesOf(get(possibility, "outcomes", {})))
		.flatMap(([, x]) => Object.keys(STANDARD_TIER_BOUNDS).flatMap(stat => {
			const range = get(getOrEmpty(x, "requirements"), stat);
			return range === null ? [] : [get(range, "min"), get(range, "max")].filter(bound => bound !== null).map(bound => [stat, bound]);
		}));
	if (bounds.length >= 2 && bounds.every(([stat, bound]) => STANDARD_TIER_BOUNDS[stat].includes(bound))) {
		report.warnings.push("every stat check uses the standard tiers: pick the difficulty of each check (easy, standard, hard, very hard) so that it changes from an event to another");
	}
}

/**
 * Whether two sets hold the same elements
 * @param {Set<unknown>} a
 * @param {Set<unknown>} b
 * @returns {boolean}
 */
function haveSameElements(a, b) {
	return a.size === b.size && [...a].every(item => b.has(item));
}

/**
 * Whether a possibility has too few outcomes ("end" may have any)
 * @param {string} name
 * @param {number} count
 * @returns {boolean}
 */
function isOutcomeCountOff(name, count) {
	return name !== "end" && count < 3;
}

// Rare outcomes (pet, badge, class…) are not capped, but the general case stays readable
const MAX_UNCONDITIONAL_OUTCOMES = 6;

/**
 * Words naming a person: an outcome where the player deals with someone almost always changes the karma
 */
const PERSON = /\b(marchande?s?|gardes?|aubergiste|forgeron|pêcheu(?:r|se)s?|voyageu(?:r|se)s?|inconnue?s?|hommes?|femmes?|enfants?|villageois(?:es?)?|paysan(?:ne)?s?|brigands?|bandits?|capitaine|ermite|vieillard|vieille|duc|princesse|chevaliers?|soldats?|moine|sorcière|mendiant|vagabond|charretier|berger|bergère|bûcheron|chasseurs?|pirates?|équipage|marins?|courtier|passants?|habitants|propriétaires?|cuisinier|clients?|noble|seigneur|sergent|mercenaires?|complices?|gamins?|ivrogne|musicien|barde|spectateurs?|comédiens?|fermiers?|fermière|guérisseu(?:r|se)|alchimiste|messager|pèlerins?|caravaniers?|nomades?|tavernier|serveuse|apprenti|écuyer)\b/iu;

/**
 * Outcomes whose text names a person but whose data leaves the karma unchanged
 * @param {Report} report
 * @param {object} dp data possibilities
 * @param {object} tp text possibilities
 */
function checkKarmaOfPeople(report, dp, tp) {
	const missing = entriesOf(dp).flatMap(([name, possibility]) => entriesOf(get(possibility, "outcomes", {}))
		.filter(([outcome, x]) => !get(x, "karma") && PERSON.test(String(get(get(get(tp, name, {}), "outcomes", {}), outcome, ""))))
		.map(([outcome]) => `${name}.${outcome}`));
	if (missing.length > 0) {
		report.warnings.push(`${missing.length} outcomes name a person without changing the karma (almost every interaction with someone does): ${missing.join(", ")}`);
	}
}

// Poultry: a player who keeps one would not pluck and roast its kin
const POULTRY_PETS = [10, 12, 19, 33, 53, 59, 62, 68, 92, 97];

/**
 * Animals the player hunts, cooks or eats, and the pets of the same species, which must not see the outcome
 */
const SAME_SPECIES = [
	{ animal: /\b(lapins?|lièvres?|lapereaux?)\b/iu, pets: [7] },
	{ animal: /\b(sangliers?|marcassins?|porcs?|cochons?|jambons?)\b/iu, pets: [9, 29] },
	{ animal: /\b(faisans?|poulets?|poules?|volailles?|canards?|oies?|dindons?|dindes?|cailles?|perdrix|pigeons?)\b/iu, pets: POULTRY_PETS },
	{ animal: /\bcombats? de coqs\b/iu, pets: [10, 92] },
	{ animal: /\brenards?\b/iu, pets: [20] },
	{ animal: /\bcrabes?\b/iu, pets: [86] },
	{ animal: /\bcrevettes?\b/iu, pets: [80] },
	{ animal: /\bhomards?\b/iu, pets: [81] },
	{ animal: /\bescargots?\b/iu, pets: [85] },
	{ animal: /\bpoulpes?\b/iu, pets: [71] },
	{ animal: /\b(moutons?|agneaux?|béliers?)\b/iu, pets: [17] },
	{ animal: /\b(chèvres?|boucs?|chevreaux?)\b/iu, pets: [18] },
	{ animal: /\b(bœufs?|vaches?|veaux?)\b/iu, pets: [8] },
	{ animal: /\b(cerfs?|chevreuils?|biches?)\b/iu, pets: [87, 98] },
	{ animal: /\btortues?\b/iu, pets: [14] }
];

// What the player does (the -ez form of the vouvoiement) or what ends on a plate, not what a character wants to do
const EATS_OR_HUNTS = /(\b(?:mangez|dévorez|plumez|abattez|dépecez|chassez|débusquez|traquez|faites (?:griller|rôtir|cuire|frire))\b|\b(?:grillée?s?|rôtie?s?|frite?s?|ragoût|soupe|gigot|brochettes?|combats? de coqs)\b)/iu;

/**
 * Outcomes where the player hunts, cooks or eats an animal kept as a pet, without excluding that pet (excludedPetTypeIds)
 * @param {Report} report
 * @param {object} dp data possibilities
 * @param {object} tp text possibilities
 * @param {Map<number, {tags: string[]}>} pets
 */
function checkSameSpeciesPets(report, dp, tp, pets) {
	const found = entriesOf(dp).flatMap(([name, possibility]) => entriesOf(get(possibility, "outcomes", {})).flatMap(([outcome, x]) => {
		const text = String(get(get(get(tp, name, {}), "outcomes", {}), outcome, ""));
		const req = getOrEmpty(x, "requirements");
		// An outcome written for one pet stages that pet on purpose
		if (!EATS_OR_HUNTS.test(text) || Object.hasOwn(req, "validPetTypeIds")) {
			return [];
		}
		const tags = get(req, "petTags", null);
		const excluded = new Set(get(req, "excludedPetTypeIds", []));
		const missing = SAME_SPECIES.filter(({ animal }) => animal.test(text))
			.flatMap(({ pets: ids }) => ids)
			.filter(id => !excluded.has(id) && (tags === null || tags.some(tag => pets.get(id)?.tags.includes(tag))));
		return missing.length > 0 ? [`${name}.${outcome} [${[...new Set(missing)].join(", ")}]`] : [];
	}));
	if (found.length > 0) {
		report.warnings.push(`${found.length} outcomes hunt, cook or eat an animal that a player may have as a pet: hide them from that pet with excludedPetTypeIds: ${found.join("; ")}`);
	}
}

/**
 * Check the outcome ids of a possibility: same as the texts, numbered 0..n-1, and their count
 * @param {Report} report
 * @param {string} name
 * @param {string[]} outcomeIds
 * @param {object} textOutcomes
 */
function checkOutcomeIds(report, name, outcomeIds, textOutcomes) {
	if (!haveSameElements(new Set(outcomeIds), new Set(keysOf(textOutcomes)))) {
		report.errors.push(`${name}: text/data outcome ids differ`);
	}
	const sortedIds = outcomeIds.map(id => [pyInt(id), id]).sort((a, b) => a[0] - b[0])
		.map(([, id]) => id);
	if (sortedIds.some((id, i) => id !== String(i))) {
		report.warnings.push(`${name}: outcome ids are not 0..n-1`);
	}
	if (isOutcomeCountOff(name, outcomeIds.length)) {
		report.warnings.push(`${name}: ${outcomeIds.length} outcomes (at least 3)`);
	}
}

/**
 * Check that the texts and the data have the same possibilities
 * @param {Report} report
 * @param {Set<string>} dataNames
 * @param {Set<string>} textNames
 */
function checkSameNames(report, dataNames, textNames) {
	if (haveSameElements(dataNames, textNames)) {
		return;
	}
	const differing = [...difference(dataNames, textNames), ...difference(textNames, dataNames)];
	report.errors.push(`text/data possibilities differ: ${pyRepr(differing.sort(byCodePoint))}`);
}

/**
 * Check the triggers: unchanged from the input, or from the draft when there is one
 * @param {Report} report
 * @param {any} inp workshop input
 * @param {object} data
 */
function checkTriggers(report, inp, data) {
	const draftData = get(getOrEmpty(inp, "draft"), "data", {});
	const inputTriggers = need(inp, "triggers");
	const expectedTriggers = isObject(draftData) && Object.hasOwn(draftData, "triggers") ? draftData.triggers : inputTriggers;
	if (!pyEqual(get(data, "triggers"), expectedTriggers)) {
		report.errors.push("data.triggers must equal the triggers of the input (or of the draft when there is one)");
	}
}

/**
 * Check the mechanics of the event: triggers, possibilities, outcomes and coverage of the player profiles
 * @param {Report} report
 * @param {any} inp workshop input
 * @param {any} out writer output
 * @param {{pets: Map<number, {rarity: number}>, materials: Map<string, unknown>}} game
 * @returns {{total: number, conditional: number}}
 */
function checkData(report, inp, out, game) {
	const data = getOrEmpty(out, "data");
	checkTriggers(report, inp, data);
	const tp = get(out, "possibilities", {});
	const dp = get(data, "possibilities", {});
	checkSameNames(report, new Set(keysOf(dp)), new Set(keysOf(tp)));
	const context = {
		inp, neighbourTypes: new Set(need(inp, "neighbours").map(neighbour => need(neighbour, "type"))), ...game
	};
	const counts = { total: 0, conditional: 0 };
	for (const [name, possibility] of entriesOf(dp)) {
		const outs = get(possibility, "outcomes", {});
		checkOutcomeIds(report, name, keysOf(outs), get(get(tp, name, {}), "outcomes", {}));
		const fightTexts = get(get(tp, name, {}), "fights", {});
		for (const [outcome, x] of entriesOf(outs)) {
			counts.total++;
			counts.conditional += checkOutcome(report, `data.${name}.${outcome}`, x, context) ? 1 : 0;
			checkOutcomeFight(report, `data.${name}.${outcome}`, x, get(fightTexts, outcome), game.monsters);
		}
		const unconditional = entriesOf(outs).filter(([, x]) => !isConditional(x)).length;
		if (unconditional > MAX_UNCONDITIONAL_OUTCOMES) {
			report.warnings.push(`${name}: ${unconditional} outcomes without condition (at most ${MAX_UNCONDITIONAL_OUTCOMES})`);
		}
		const coverageError = checkCoverage(name, entriesOf(outs).map(([, x]) => x), game.pets);
		if (coverageError) {
			report.errors.push(coverageError);
		}
		// The player picks every possibility but end, where the free character makes the scene vary on its own
		const monotony = name === "end" ? null : checkMonotony(name, entriesOf(outs), game.pets);
		if (monotony) {
			report.warnings.push(monotony);
		}
	}
	checkTierVariety(report, dp);
	checkKarmaOfPeople(report, dp, tp);
	checkSameSpeciesPets(report, dp, tp, game.pets);
	const fightingChoices = entriesOf(dp).filter(([, possibility]) => entriesOf(get(possibility, "outcomes", {})).some(([, x]) => get(x, "fight") !== null));
	if (fightingChoices.length > 1) {
		report.warnings.push(`${fightingChoices.length} choices lead to a fight (at most 1 per event)`);
	}
	return counts;
}

/**
 * Check the amount of outcomes: enough conditional ones, more than the original event
 * @param {Report} report
 * @param {{total: number, conditional: number}} counts
 * @param {object} origPossibilities
 */
function checkOutcomeCounts(report, { total, conditional }, origPossibilities) {
	if (total && conditional / total < 0.4) {
		report.warnings.push(`only ${conditional}/${total} outcomes are conditional (rewritten events: about 3/4)`);
	}
	const originalTotal = entriesOf(origPossibilities).reduce((sum, [, possibility]) => sum + keysOf(need(possibility, "outcomes")).length, 0);
	if (total <= originalTotal) {
		report.warnings.push(`${total} outcomes, not more than the original`);
	}
}

/**
 * Check that every new possibility has an emoji
 * @param {Report} report
 * @param {object} icons
 * @param {object} tp possibilities of the texts
 * @param {object} origPossibilities
 */
function checkPossibilityIcons(report, icons, tp, origPossibilities) {
	const newPossibilities = difference(difference(keysOf(tp), keysOf(origPossibilities)), ["end"]);
	for (const name of [...newPossibilities].filter(possibility => !truthy(get(icons, possibility)))) {
		report.errors.push(`icons: missing emoji for new possibility ${name}`);
	}
}

/**
 * Check that every new outcome of the "end" possibility has an emoji
 * @param {Report} report
 * @param {object} icons
 * @param {object} tp possibilities of the texts
 * @param {object} origPossibilities
 */
function checkEndIcons(report, icons, tp, origPossibilities) {
	const newEnd = difference(keysOf(get(get(tp, "end", {}), "outcomes", {})), keysOf(get(get(origPossibilities, "end", {}), "outcomes", {})));
	const endIcons = getOrEmpty(icons, "end");
	for (const outcome of [...newEnd].filter(endOutcome => !truthy(get(endIcons, endOutcome)))) {
		report.errors.push(`icons: missing emoji for new end outcome ${outcome}`);
	}
}

/**
 * Run the checks of an event
 * @param {any} inp workshop input
 * @param {any} out writer output
 * @param {Map<number, {rarity: number}>} pets
 * @param {Map<string, unknown>} materials
 * @returns {{errors: string[], warnings: string[], total: number, conditional: number}}
 */
function validate(inp, out, pets, materials) {
	const orig = need(inp, "original");
	const origPossibilities = need(orig, "possibilities");
	const report = { errors: [], warnings: [] };
	checkTexts(report, out, orig);
	const counts = checkData(report, inp, out, {
		pets, materials, weaponTags: loadWeaponTags(), eventBadges: loadEventBadges(), monsters: loadMonsters()
	});
	checkConsistency(report, out, pets);
	checkOutcomeCounts(report, counts, origPossibilities);
	const icons = getOrEmpty(out, "icons");
	const tp = get(out, "possibilities", {});
	checkPossibilityIcons(report, icons, tp, origPossibilities);
	checkEndIcons(report, icons, tp, origPossibilities);
	if (!truthy(get(out, "notes"))) {
		report.warnings.push("notes: missing");
	}
	return { ...report, ...counts };
}

/**
 * @param {string[]} argv
 * @returns {number} exit code
 */
function main(argv) {
	const { values: options, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: { work: { type: "string" } }
	});
	if (positionals.length !== 1) {
		console.error("Usage: node validate.mjs <event id> [--work <dir>]");
		return 2;
	}
	const [eventId] = positionals;
	const work = workDirectory(options.work);
	const inp = readJson(join(work, "input", `${eventId}.json`));
	const out = readJson(join(work, "out", `${eventId}.json`));
	const {
		errors, warnings, total, conditional
	} = validate(inp, out, loadPets(), loadMaterials());
	console.log(`${total} outcomes, ${conditional} conditional`);
	console.log([errors.length > 0 ? "ERRORS:" : "OK, no error", ...errors].join("\n  "));
	console.log([warnings.length > 0 ? "WARNINGS:" : "no warning", ...warnings].join("\n  "));
	return errors.length > 0 ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
