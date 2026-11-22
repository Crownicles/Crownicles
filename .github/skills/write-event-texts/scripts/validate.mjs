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
	difference, get, getOrEmpty, inRange, need, pyEqual, pyInt, pyRepr, pyStr, truthy
} from "./python.mjs";

const OUTCOME_KEYS = new Set([
	"condition", "requirements", "lostTime", "health", "karma", "effect", "money", "energy", "gems", "tokens", "bonusExperience",
	"bonusPoints", "randomItem", "randomPet", "givePet", "oneshot", "nextEvent", "mapTypesDestination", "mapTypesExcludeDestination",
	"mapLink", "forceStayInCity", "forceLeaveCity", "tags", "consumeMaterials", "giveMaterials"
]);
const REQ_RANGES = ["level", "karma", "health", "attack", "defense", "speed", "petRarity", "cookingLevel", "weaponLevel", "armorLevel"];
const REQ_KEYS = new Set([...REQ_RANGES, "validClassIds", "validPetTypeIds", "campaignCurrentMissionId", "materials", "enchantment"]);
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
const TEXT_LENGTHS = {
	intro: [180, 420],
	choice: [8, 90],
	outcome: [90, 300]
};

// Python's Unicode \w and \s, so that the checks behave like the original Python validator
const WORD = "[\\p{L}\\p{N}_]";
const SPACE = "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const PLACEHOLDER = /\{\{[^}]+\}\}|\{emote:[^}]+\}|\$t\([^)]+\)/gu;
const DIRECT_SPEECH_VERB = new RegExp(
	`(?<!${WORD})(?:dit-il|dit-elle|s'exclame-t-il|s'exclame-t-elle|s'écrie-t-il|répond-il|répond-elle|lance-t-il|lance-t-elle|ajoute-t-il|ajoute-t-elle)(?!${WORD})`,
	"u"
);
const NAMED_CONDITION = new RegExp(
	`(?<!${WORD})(?:Votre|Vos) (?:agilité|réputation|aura|force|vitesse|niveau|karma|expérience)(?!${WORD})`,
	"u"
);
const MISSING_SPACE = new RegExp(`[^${SPACE}][!?;:]`, "u");
const TRAILING_SPACES = new RegExp(`[${SPACE}]+$`, "u");
const BLANK = new RegExp(`^[${SPACE}]*$`, "u");

/**
 * Pets of the game: id -> { name, rarity } (pet 0 is "no pet")
 * @returns {Map<number, {name: string, rarity: number}>}
 */
function loadPets() {
	const names = readJson(join(REPO_ROOT, "Lang/fr/models.json")).pets;
	const directory = join(REPO_ROOT, "Core/resources/pets");
	return new Map(readdirSync(directory).filter(file => file.endsWith(".json"))
		.map(file => {
			const id = Number(basename(file, ".json"));
			return [id, { name: names[`${id}_male`], rarity: readJson(join(directory, file)).rarity }];
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

const byNumber = (a, b) => a - b;
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Collected problems of an event: errors block the rewrite, warnings are advice
 * @typedef {{errors: string[], warnings: string[]}} Report
 */

/**
 * Style rules of a text: each one reports an error or a warning when its test matches
 * @type {{level: "errors" | "warnings", test: (text: string, kind: string) => boolean, message: string}[]}
 */
const TEXT_RULES = [
	{
		level: "errors", test: text => /[«»"“”]/u.test(text), message: "quotes (no direct speech)"
	},
	{
		level: "errors", test: text => DIRECT_SPEECH_VERB.test(text), message: "direct speech verb"
	},
	{
		level: "errors", test: text => text.includes("’"), message: "curly apostrophe"
	},
	{
		level: "errors", test: text => text.includes("—"), message: "em dash"
	},
	{
		level: "warnings", test: text => MISSING_SPACE.test(text.replace(/\{[^}]*\}|\$t\([^)]*\)/gu, "")), message: "missing space before ! ? ; :"
	},
	{
		level: "warnings", test: text => text.split("!").length - 1 > 1, message: "more than one !"
	},
	{
		level: "warnings", test: text => NAMED_CONDITION.test(text), message: "names the condition instead of showing it"
	},
	{
		level: "errors", test: (text, kind) => kind === "intro" && /(?:\.\.\.|…)$/u.test(text.replace(TRAILING_SPACES, "")), message: "intro ends with ellipsis"
	}
];

/**
 * Check the style and the length of a text, and that it keeps the placeholders of the original one
 * @param {Report} report
 * @param {string} path
 * @param {unknown} text
 * @param {string} ref original text
 * @param {"intro" | "choice" | "outcome"} kind
 */
function checkText(report, path, text, ref = "", kind = "outcome") {
	if (typeof text !== "string" || BLANK.test(text)) {
		report.errors.push(`${path}: empty text`);
		return;
	}
	for (const placeholder of new Set((ref || "").match(PLACEHOLDER) ?? [])) {
		if (!text.includes(placeholder)) {
			report.errors.push(`${path}: placeholder ${placeholder} missing`);
		}
	}
	for (const rule of TEXT_RULES.filter(textRule => textRule.test(text, kind))) {
		report[rule.level].push(`${path}: ${rule.message}`);
	}
	const [low, high] = TEXT_LENGTHS[kind];
	const length = [...text].length;
	if (length < low || length > high) {
		report.warnings.push(`${path}: ${length} chars (target ${low}-${high})`);
	}
}

/**
 * Check the texts: intro, choice labels and outcomes, against the original ones
 * @param {Report} report
 * @param {any} out writer output
 * @param {any} orig original event
 */
function checkTexts(report, out, orig) {
	const origPossibilities = need(orig, "possibilities");
	checkText(report, "text", get(out, "text"), need(orig, "text"), "intro");
	const tp = get(out, "possibilities", {});
	const missing = difference(keysOf(origPossibilities), keysOf(tp));
	if (missing.size > 0) {
		report.errors.push(`original possibilities removed: ${pyRepr([...missing].sort(byCodePoint))}`);
	}
	if (difference(keysOf(tp), keysOf(origPossibilities)).size > 2) {
		report.warnings.push("more than 2 new possibilities");
	}
	for (const [name, possibility] of entriesOf(tp)) {
		const origPossibility = get(origPossibilities, name, {});
		if (name !== "end") {
			checkText(report, `${name}.text`, get(possibility, "text"), get(origPossibility, "text", ""), "choice");
		}
		else if (truthy(get(possibility, "text"))) {
			report.errors.push("end.text: the end possibility has no choice label");
		}
		for (const [outcome, text] of entriesOf(get(possibility, "outcomes", {}))) {
			checkText(report, `${name}.outcomes.${outcome}`, text, get(get(origPossibility, "outcomes", {}), outcome, ""));
		}
	}
}

/**
 * Check a material filter: known keys, type and ids
 * @param {Report} report
 * @param {string} path
 * @param {object} filter
 * @param {Map<string, unknown>} materials
 */
function checkMaterialFilter(report, path, filter, materials) {
	const unknown = difference(keysOf(filter), new Set(["type", "rarity", "ids", "quantity"]));
	if (unknown.size > 0) {
		report.errors.push(`${path}: unknown filter ${pyRepr(unknown)}`);
	}
	if (Object.hasOwn(filter, "type") && !MATERIAL_TYPES.has(filter.type)) {
		report.errors.push(`${path}: unknown material type ${pyStr(filter.type)}`);
	}
	for (const id of get(filter, "ids", [])) {
		if (!materials.has(pyStr(id))) {
			report.errors.push(`${path}: unknown material ${pyStr(id)}`);
		}
	}
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
		const quantity = get(x[field], "quantity");
		if (!(quantity === true || Number.isInteger(quantity) && quantity > 0)) {
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
	return get(range, "min") !== null && get(range, "max") !== null && range.min > range.max;
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
 * Check the requirements of an outcome
 * @param {Report} report
 * @param {string} path
 * @param {object} req
 * @param {{pets: Map<number, unknown>, materials: Map<string, unknown>}} game
 */
function checkRequirements(report, path, req, game) {
	for (const key of difference(keysOf(req), REQ_KEYS)) {
		report.errors.push(`${path}: unknown requirement ${key}`);
	}
	for (const key of REQ_RANGES.filter(rangeKey => get(req, rangeKey) !== null && isBadRange(req[rangeKey]))) {
		report.errors.push(`${path}: bad range for ${key}`);
	}
	for (const key of ["validClassIds", "validPetTypeIds"]) {
		if (Object.hasOwn(req, key) && !(Array.isArray(req[key]) && req[key].length > 0)) {
			report.errors.push(`${path}: ${key} must be a non-empty list`);
		}
	}
	for (const petId of get(req, "validPetTypeIds", [])) {
		if (!game.pets.has(typeof petId === "boolean" ? Number(petId) : petId)) {
			report.errors.push(`${path}: unknown pet ${pyStr(petId)}`);
		}
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
 * Check the mechanics of an outcome: keys, effect, city and destination constraints, materials, requirements
 * @param {Report} report
 * @param {string} path
 * @param {any} x outcome data
 * @param {{inp: any, neighbourTypes: Set<string>, pets: Map<number, unknown>, materials: Map<string, unknown>}} context
 * @returns {boolean} whether the outcome is conditional
 */
function checkOutcome(report, path, x, context) {
	for (const key of difference(keysOf(x), OUTCOME_KEYS)) {
		report.errors.push(`${path}: unknown key ${key}`);
	}
	if (Object.hasOwn(x, "effect") && !EFFECTS.has(x.effect)) {
		report.errors.push(`${path}: unknown effect ${pyStr(x.effect)}`);
	}
	if (get(x, "effect") === "occupied" && !truthy(get(x, "lostTime"))) {
		report.warnings.push(`${path}: occupied without lostTime`);
	}
	const changesCityStay = truthy(get(x, "forceStayInCity")) || truthy(get(x, "forceLeaveCity"));
	if (changesCityStay && !truthy(need(context.inp, "isCity"))) {
		report.errors.push(`${path}: forceStayInCity/forceLeaveCity outside a city`);
	}
	if (truthy(get(x, "mapTypesDestination")) && !Array.from(x.mapTypesDestination).some(type => context.neighbourTypes.has(type))) {
		report.errors.push(`${path}: no neighbour of type ${pyStr(x.mapTypesDestination)}`);
	}
	checkOutcomeMaterials(report, path, x, context.materials);
	const req = getOrEmpty(x, "requirements");
	if (!truthy(req) && !Object.hasOwn(x, "consumeMaterials")) {
		return false;
	}
	checkRequirements(report, path, req, context);
	return true;
}

/**
 * Check the outcome ids of a possibility: same as the texts, numbered 0..n-1, and their count
 * @param {Report} report
 * @param {string} name
 * @param {string[]} outcomeIds
 * @param {object} textOutcomes
 */
function checkOutcomeIds(report, name, outcomeIds, textOutcomes) {
	const textIds = new Set(keysOf(textOutcomes));
	if (outcomeIds.length !== textIds.size || outcomeIds.some(id => !textIds.has(id))) {
		report.errors.push(`${name}: text/data outcome ids differ`);
	}
	const sortedIds = outcomeIds.map(id => [pyInt(id), id]).sort((a, b) => a[0] - b[0])
		.map(([, id]) => id);
	if (sortedIds.some((id, i) => id !== String(i))) {
		report.warnings.push(`${name}: outcome ids are not 0..n-1`);
	}
	if (!(outcomeIds.length >= 3 && outcomeIds.length <= 8) && name !== "end") {
		report.warnings.push(`${name}: ${outcomeIds.length} outcomes (target 3-6)`);
	}
}

/**
 * Check that two sets of names are equal
 * @param {Report} report
 * @param {Set<string>} dataNames
 * @param {Set<string>} textNames
 */
function checkSameNames(report, dataNames, textNames) {
	if (dataNames.size === textNames.size && [...dataNames].every(name => textNames.has(name))) {
		return;
	}
	const differing = [...difference(dataNames, textNames), ...difference(textNames, dataNames)];
	report.errors.push(`text/data possibilities differ: ${pyRepr(differing.sort(byCodePoint))}`);
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
	const draftData = get(getOrEmpty(inp, "draft"), "data", {});
	const inputTriggers = need(inp, "triggers");
	const expectedTriggers = isObject(draftData) && Object.hasOwn(draftData, "triggers") ? draftData.triggers : inputTriggers;
	if (!pyEqual(get(data, "triggers"), expectedTriggers)) {
		report.errors.push("data.triggers must equal the triggers of the input (or of the draft when there is one)");
	}
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
 * Check that every new possibility and new "end" outcome has an emoji, and that there are notes
 * @param {Report} report
 * @param {any} out writer output
 * @param {object} origPossibilities
 */
function checkIconsAndNotes(report, out, origPossibilities) {
	const tp = get(out, "possibilities", {});
	const icons = getOrEmpty(out, "icons");
	for (const name of difference(difference(keysOf(tp), keysOf(origPossibilities)), ["end"])) {
		if (!truthy(get(icons, name))) {
			report.errors.push(`icons: missing emoji for new possibility ${name}`);
		}
	}
	const newEnd = difference(keysOf(get(get(tp, "end", {}), "outcomes", {})), keysOf(get(get(origPossibilities, "end", {}), "outcomes", {})));
	for (const outcome of newEnd) {
		if (!truthy(get(getOrEmpty(icons, "end"), outcome))) {
			report.errors.push(`icons: missing emoji for new end outcome ${outcome}`);
		}
	}
	if (!truthy(get(out, "notes"))) {
		report.warnings.push("notes: missing");
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
	checkIconsAndNotes(report, out, origPossibilities);
	return { ...report, ...counts };
}

/**
 * Requirements of each outcome, the consumed materials counting as a material requirement
 * @param {any[]} outs
 * @returns {object[]}
 */
function coverageRequirements(outs) {
	return outs.map(x => {
		const requirements = truthy(get(x, "requirements")) ? { ...x.requirements } : {};
		if (Object.hasOwn(x, "consumeMaterials")) {
			requirements.materials = { quantity: { min: need(x.consumeMaterials, "quantity") } };
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
 * @param {Map<number, {rarity: number}>} pets
 * @returns {[string, unknown[]][]}
 */
function coverageDimensions(reqs, pets) {
	const listedPets = [...new Set(reqs.flatMap(r => get(r, "validPetTypeIds", [])))].sort(byNumber);
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
		["class", [...new Set([...reqs.flatMap(r => get(r, "validClassIds", [])), 0])].sort(byNumber)],
		["pet", petProfiles],
		["cooking", optionalLevel("cookingLevel", [0, 100])],
		["weaponLevel", optionalLevel("weaponLevel", [0, 10])],
		["armorLevel", optionalLevel("armorLevel", [0, 10])],
		["hasMaterials", uses("materials") ? [false, true] : [true]],
		["hasEnchantment", uses("enchantment") ? [false, true] : [true]]
	];
}

/**
 * Whether the equipment and cooking requirements accept the profile
 * @param {object} r requirements
 * @param {object} profile
 * @returns {boolean}
 */
function areLevelsCovered(r, profile) {
	return [["cookingLevel", profile.cooking], ["weaponLevel", profile.weaponLevel], ["armorLevel", profile.armorLevel]]
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
	return !Object.hasOwn(r, "enchantment") || profile.hasEnchantment;
}

/**
 * Whether the level, karma, health and fight stat requirements accept the profile
 * @param {object} r requirements
 * @param {object} profile
 * @returns {boolean}
 */
function areStatsCovered(r, profile) {
	return ["level", "karma", "health", "attack", "defense", "speed"].every(key => inRange(get(r, key), profile[key]));
}

/**
 * Whether the class and pet requirements accept the profile
 * @param {object} r requirements
 * @param {object} profile
 * @returns {boolean}
 */
function isIdentityCovered(r, { class: cls, pet }) {
	if (Object.hasOwn(r, "validClassIds") && !r.validClassIds.includes(cls)) {
		return false;
	}
	if (Object.hasOwn(r, "validPetTypeIds") && (pet === null || !r.validPetTypeIds.includes(pet[0]))) {
		return false;
	}
	return !Object.hasOwn(r, "petRarity") || pet !== null && inRange(r.petRarity, pet[1]);
}

/**
 * Whether an outcome with these requirements is valid for the profile
 * @param {object} r requirements
 * @param {object} profile
 * @returns {boolean}
 */
function isProfileCovered(r, profile) {
	return areLevelsCovered(r, profile)
		&& areBelongingsCovered(r, profile)
		&& areStatsCovered(r, profile)
		&& isIdentityCovered(r, profile)
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
	return `${name}: no valid outcome for level=${profile.level} karma=${profile.karma} health=${profile.health} attack=${profile.attack} defense=${profile.defense} speed=${profile.speed} class=${profile.class} pet=${pet === null ? "None" : `(${pet[0]}, ${pet[1]})`}`
		+ ` cooking=${profile.cooking} weaponLevel=${profile.weaponLevel} armorLevel=${profile.armorLevel} materials=${profile.hasMaterials ? "oui" : "aucun"} enchantment=${profile.hasEnchantment ? "oui" : "aucun"}`;
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
 * @param {Map<number, {rarity: number}>} pets
 * @returns {string | null} the error for the first uncovered profile
 */
function checkCoverage(name, outs, pets) {
	const reqs = coverageRequirements(outs);
	if (outs.length === 0) {
		return null;
	}
	for (const profile of profilesOf(coverageDimensions(reqs, pets))) {
		if (!reqs.some(r => isProfileCovered(r, profile))) {
			return uncoveredProfileError(name, profile);
		}
	}
	return null;
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
