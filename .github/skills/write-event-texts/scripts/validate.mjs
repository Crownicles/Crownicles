/**
 * Validate a rewritten event: <work>/out/<id>.json against <work>/input/<id>.json.
 *
 * Usage:
 *   node validate.mjs <event id> [--work <dir>]
 *
 * Prints "<n> outcomes, <m> conditional", then the errors and the warnings. Exits with 1 when there is an error.
 * Pets (id, rarity) and materials (id) come from Core/resources of the repository.
 */
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import {
	entriesOf, isObject, keysOf, readJson, REPO_ROOT, workDirectory
} from "./common.mjs";
import {
	byCodePoint, difference, get, getOrEmpty, need, pyEqual, pyInt, pyRepr, pyStr, truthy
} from "./python.mjs";
import { checkCoverage } from "./coverage.mjs";
import { checkTexts } from "./texts.mjs";

/** @typedef {import("./texts.mjs").Report} Report */

const OUTCOME_KEYS = new Set([
	"condition", "requirements", "lostTime", "health", "karma", "effect", "money", "energy", "gems", "tokens", "bonusExperience",
	"bonusPoints", "randomItem", "randomPet", "givePet", "oneshot", "nextEvent", "mapTypesDestination", "mapTypesExcludeDestination",
	"mapLink", "forceStayInCity", "forceLeaveCity", "tags", "consumeMaterials", "giveMaterials"
]);
const REQ_RANGES = ["level", "karma", "health", "attack", "defense", "speed", "petRarity", "cookingLevel", "weaponLevel", "armorLevel"];
const REQ_LISTS = ["validClassIds", "validPetTypeIds", "petTags"];
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
		checkMaterialFilter(report, `${path}.${field}`, x[field], materials);
		if (!isPositiveQuantity(get(x[field], "quantity"))) {
			report.errors.push(`${path}.${field}: quantity must be a positive integer`);
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
	for (const petId of get(req, "validPetTypeIds", []).filter(isUnknownPet)) {
		report.errors.push(`${path}: unknown pet ${pyStr(petId)}`);
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
	const req = getOrEmpty(x, "requirements");
	if (!truthy(req) && !Object.hasOwn(x, "consumeMaterials")) {
		return false;
	}
	checkRequirementShapes(report, path, req);
	checkRequirementReferences(report, path, req, context);
	return true;
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
 * Whether a possibility has an unusual number of outcomes ("end" may have any)
 * @param {string} name
 * @param {number} count
 * @returns {boolean}
 */
function isOutcomeCountOff(name, count) {
	if (name === "end") {
		return false;
	}
	return count < 3 || count > 8;
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
		report.warnings.push(`${name}: ${outcomeIds.length} outcomes (target 3-6)`);
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
		for (const [outcome, x] of entriesOf(outs)) {
			counts.total++;
			counts.conditional += checkOutcome(report, `data.${name}.${outcome}`, x, context) ? 1 : 0;
		}
		const coverageError = checkCoverage(name, entriesOf(outs).map(([, x]) => x), game.pets);
		if (coverageError) {
			report.errors.push(coverageError);
		}
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
	const counts = checkData(report, inp, out, { pets, materials });
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
