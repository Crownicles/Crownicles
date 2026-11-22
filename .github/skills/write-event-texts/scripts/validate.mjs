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

/**
 * Python's repr() of a JSON value (sets are JS Sets)
 * @param {unknown} value
 * @returns {string}
 */
function pyRepr(value) {
	if (value === null || value === undefined) {
		return "None";
	}
	if (typeof value === "boolean") {
		return value ? "True" : "False";
	}
	if (typeof value === "string") {
		const quote = value.includes("'") && !value.includes("\"") ? "\"" : "'";
		const escaped = value.replace(/[\\\n\r\t]|[\p{C}\p{Z}]/gu, char => {
			const escapes = {
				"\\": "\\\\", "\n": "\\n", "\r": "\\r", "\t": "\\t", " ": " "
			};
			if (escapes[char]) {
				return escapes[char];
			}
			const code = char.codePointAt(0);
			return code <= 0xff ? `\\x${code.toString(16).padStart(2, "0")}` : code <= 0xffff ? `\\u${code.toString(16).padStart(4, "0")}` : `\\U${code.toString(16).padStart(8, "0")}`;
		});
		return quote + escaped.replaceAll(quote, `\\${quote}`) + quote;
	}
	if (value instanceof Set) {
		return value.size === 0 ? "set()" : `{${[...value].map(pyRepr).join(", ")}}`;
	}
	if (Array.isArray(value)) {
		return `[${value.map(pyRepr).join(", ")}]`;
	}
	if (isObject(value)) {
		return `{${entriesOf(value).map(([key, child]) => `${pyRepr(key)}: ${pyRepr(child)}`)
			.join(", ")}}`;
	}
	return String(value);
}

/**
 * Python's str() of a JSON value (what an f-string prints)
 * @param {unknown} value
 * @returns {string}
 */
function pyStr(value) {
	return typeof value === "string" ? value : pyRepr(value);
}

/**
 * Python's truthiness of a JSON value
 * @param {unknown} value
 * @returns {boolean}
 */
function truthy(value) {
	if (Array.isArray(value)) {
		return value.length > 0;
	}
	if (isObject(value)) {
		return keysOf(value).length > 0;
	}
	return Boolean(value);
}

/**
 * Python's dict.get(key)
 * @param {unknown} object
 * @param {string} key
 * @param {unknown} fallback
 * @returns {any}
 */
function get(object, key, fallback = null) {
	return isObject(object) && Object.hasOwn(object, key) ? object[key] : fallback;
}

/**
 * Python's dict[key]: a missing key is a KeyError
 * @param {object} object
 * @param {string} key
 * @returns {any}
 */
function need(object, key) {
	if (!isObject(object) || !Object.hasOwn(object, key)) {
		throw new Error(`KeyError: ${pyRepr(key)}`);
	}
	return object[key];
}

/**
 * Python's int() of an outcome id
 * @param {string} text
 * @returns {number}
 */
function pyInt(text) {
	if (!/^\s*[+-]?\d+(?:_\d+)*\s*$/u.test(text)) {
		throw new Error(`ValueError: invalid literal for int() with base 10: ${pyRepr(text)}`);
	}
	return Number(text.replaceAll("_", ""));
}

/**
 * Python's == between JSON values
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function pyEqual(a, b) {
	const scalar = value => (typeof value === "boolean" ? Number(value) : value);
	if (Array.isArray(a) || Array.isArray(b)) {
		return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => pyEqual(item, b[i]));
	}
	if (isObject(a) || isObject(b)) {
		if (!isObject(a) || !isObject(b)) {
			return false;
		}
		const keys = keysOf(a);
		return keys.length === keysOf(b).length && keys.every(key => Object.hasOwn(b, key) && pyEqual(a[key], b[key]));
	}
	return scalar(a ?? null) === scalar(b ?? null);
}

/**
 * Elements of a, in order, that are not in b (Python's set(a) - set(b))
 * @param {Iterable<unknown>} a
 * @param {Set<unknown> | Iterable<unknown>} b
 * @returns {Set<unknown>}
 */
function difference(a, b) {
	const excluded = b instanceof Set ? b : new Set(b);
	return new Set([...a].filter(item => !excluded.has(item)));
}

const byNumber = (a, b) => a - b;
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Whether a value is in a range ({min, max}, both optional); no range accepts everything
 * @param {unknown} range
 * @param {number} value
 * @returns {boolean}
 */
function inRange(range, value) {
	const min = get(range, "min");
	const max = get(range, "max");
	return !truthy(range) || !(min !== null && value < min || max !== null && value > max);
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
	const errors = [];
	const warnings = [];

	const checkMaterialFilter = (path, filter, extra) => {
		const allowed = new Set(["type", "rarity", "ids", ...extra]);
		const unknown = difference(keysOf(filter), allowed);
		if (unknown.size > 0) {
			errors.push(`${path}: unknown filter ${pyRepr(unknown)}`);
		}
		if (Object.hasOwn(filter, "type") && !MATERIAL_TYPES.has(filter.type)) {
			errors.push(`${path}: unknown material type ${pyStr(filter.type)}`);
		}
		for (const id of get(filter, "ids", [])) {
			if (!materials.has(pyStr(id))) {
				errors.push(`${path}: unknown material ${pyStr(id)}`);
			}
		}
	};

	const checkText = (path, text, ref = "", kind = "outcome") => {
		if (typeof text !== "string" || BLANK.test(text)) {
			errors.push(`${path}: empty text`);
			return;
		}
		for (const placeholder of new Set((ref || "").match(PLACEHOLDER) ?? [])) {
			if (!text.includes(placeholder)) {
				errors.push(`${path}: placeholder ${placeholder} missing`);
			}
		}
		if (/[«»"“”]/u.test(text)) {
			errors.push(`${path}: quotes (no direct speech)`);
		}
		if (DIRECT_SPEECH_VERB.test(text)) {
			errors.push(`${path}: direct speech verb`);
		}
		if (text.includes("’")) {
			errors.push(`${path}: curly apostrophe`);
		}
		if (text.includes("—")) {
			errors.push(`${path}: em dash`);
		}
		if (MISSING_SPACE.test(text.replace(/\{[^}]*\}|\$t\([^)]*\)/gu, ""))) {
			warnings.push(`${path}: missing space before ! ? ; :`);
		}
		if (text.split("!").length - 1 > 1) {
			warnings.push(`${path}: more than one !`);
		}
		if (NAMED_CONDITION.test(text)) {
			warnings.push(`${path}: names the condition instead of showing it`);
		}
		const trimmed = text.replace(TRAILING_SPACES, "");
		if (kind === "intro" && (trimmed.endsWith("...") || trimmed.endsWith("…"))) {
			errors.push(`${path}: intro ends with ellipsis`);
		}
		const [low, high] = TEXT_LENGTHS[kind];
		const length = [...text].length;
		if (length < low || length > high) {
			warnings.push(`${path}: ${length} chars (target ${low}-${high})`);
		}
	};

	// --- texts ---
	checkText("text", get(out, "text"), need(orig, "text"), "intro");
	const tp = get(out, "possibilities", {});
	const missing = difference(keysOf(origPossibilities), keysOf(tp));
	if (missing.size > 0) {
		errors.push(`original possibilities removed: ${pyRepr([...missing].sort(byCodePoint))}`);
	}
	if (difference(keysOf(tp), keysOf(origPossibilities)).size > 2) {
		warnings.push("more than 2 new possibilities");
	}
	for (const [name, possibility] of entriesOf(tp)) {
		const origPossibility = get(origPossibilities, name, {});
		if (name === "end") {
			if (truthy(get(possibility, "text"))) {
				errors.push("end.text: the end possibility has no choice label");
			}
		}
		else {
			checkText(`${name}.text`, get(possibility, "text"), get(origPossibility, "text", ""), "choice");
		}
		for (const [outcome, text] of entriesOf(get(possibility, "outcomes", {}))) {
			checkText(`${name}.outcomes.${outcome}`, text, get(get(origPossibility, "outcomes", {}), outcome, ""));
		}
	}

	// --- data ---
	const data = truthy(get(out, "data")) ? out.data : {};
	const draft = truthy(get(inp, "draft")) ? inp.draft : {};
	const draftData = get(draft, "data", {});
	const inputTriggers = need(inp, "triggers");
	const expectedTriggers = isObject(draftData) && Object.hasOwn(draftData, "triggers") ? draftData.triggers : inputTriggers;
	if (!pyEqual(get(data, "triggers"), expectedTriggers)) {
		errors.push("data.triggers must equal the triggers of the input (or of the draft when there is one)");
	}
	const dp = get(data, "possibilities", {});
	const textNames = new Set(keysOf(tp));
	const dataNames = new Set(keysOf(dp));
	if (dataNames.size !== textNames.size || [...dataNames].some(name => !textNames.has(name))) {
		const differing = [...difference(dataNames, textNames), ...difference(textNames, dataNames)];
		errors.push(`text/data possibilities differ: ${pyRepr(differing.sort(byCodePoint))}`);
	}
	const neighbourTypes = new Set(need(inp, "neighbours").map(neighbour => need(neighbour, "type")));
	let total = 0;
	let conditional = 0;
	for (const [name, possibility] of entriesOf(dp)) {
		const outs = get(possibility, "outcomes", {});
		const outcomeIds = keysOf(outs);
		const textIds = new Set(keysOf(get(get(tp, name, {}), "outcomes", {})));
		if (outcomeIds.length !== textIds.size || outcomeIds.some(id => !textIds.has(id))) {
			errors.push(`${name}: text/data outcome ids differ`);
		}
		const sortedIds = outcomeIds.map(id => [pyInt(id), id]).sort((a, b) => a[0] - b[0])
			.map(([, id]) => id);
		if (sortedIds.some((id, i) => id !== String(i))) {
			warnings.push(`${name}: outcome ids are not 0..n-1`);
		}
		if (!(outcomeIds.length >= 3 && outcomeIds.length <= 8) && name !== "end") {
			warnings.push(`${name}: ${outcomeIds.length} outcomes (target 3-6)`);
		}
		for (const [outcome, x] of entriesOf(outs)) {
			total++;
			const path = `data.${name}.${outcome}`;
			for (const key of difference(keysOf(x), OUTCOME_KEYS)) {
				errors.push(`${path}: unknown key ${key}`);
			}
			if (Object.hasOwn(x, "effect") && !EFFECTS.has(x.effect)) {
				errors.push(`${path}: unknown effect ${pyStr(x.effect)}`);
			}
			if (get(x, "effect") === "occupied" && !truthy(get(x, "lostTime"))) {
				warnings.push(`${path}: occupied without lostTime`);
			}
			if ((truthy(get(x, "forceStayInCity")) || truthy(get(x, "forceLeaveCity"))) && !truthy(need(inp, "isCity"))) {
				errors.push(`${path}: forceStayInCity/forceLeaveCity outside a city`);
			}
			if (truthy(get(x, "mapTypesDestination")) && !Array.from(x.mapTypesDestination).some(type => neighbourTypes.has(type))) {
				errors.push(`${path}: no neighbour of type ${pyStr(x.mapTypesDestination)}`);
			}
			for (const field of ["consumeMaterials", "giveMaterials"]) {
				if (Object.hasOwn(x, field)) {
					checkMaterialFilter(`${path}.${field}`, x[field], ["quantity"]);
					const quantity = get(x[field], "quantity");
					if (!(quantity === true || Number.isInteger(quantity) && quantity > 0)) {
						errors.push(`${path}.${field}: quantity must be a positive integer`);
					}
				}
			}
			const req = truthy(get(x, "requirements")) ? x.requirements : {};
			if (truthy(req) || Object.hasOwn(x, "consumeMaterials")) {
				conditional++;
				for (const key of difference(keysOf(req), REQ_KEYS)) {
					errors.push(`${path}: unknown requirement ${key}`);
				}
				for (const key of REQ_RANGES) {
					const range = get(req, key);
					if (range !== null && (!isObject(range) || get(range, "min") !== null && get(range, "max") !== null && range.min > range.max)) {
						errors.push(`${path}: bad range for ${key}`);
					}
				}
				for (const key of ["validClassIds", "validPetTypeIds"]) {
					if (Object.hasOwn(req, key) && !(Array.isArray(req[key]) && req[key].length > 0)) {
						errors.push(`${path}: ${key} must be a non-empty list`);
					}
				}
				for (const petId of get(req, "validPetTypeIds", [])) {
					if (!pets.has(typeof petId === "boolean" ? Number(petId) : petId)) {
						errors.push(`${path}: unknown pet ${pyStr(petId)}`);
					}
				}
				const materialFilter = get(req, "materials");
				if (materialFilter !== null) {
					checkMaterialFilter(`${path}.requirements.materials`, materialFilter, ["quantity"]);
				}
				const enchantment = get(req, "enchantment");
				if (enchantment !== null) {
					const unknown = difference(keysOf(enchantment), ENCHANT_FILTERS);
					if (unknown.size > 0) {
						errors.push(`${path}: unknown enchantment filter ${pyRepr(unknown)}`);
					}
					if (![null, "weapon", "armor"].includes(get(enchantment, "slot"))) {
						errors.push(`${path}: enchantment slot must be weapon or armor`);
					}
					for (const type of difference(get(enchantment, "types", []), ENCHANT_TYPES)) {
						errors.push(`${path}: unknown enchantment type ${pyStr(type)}`);
					}
					for (const kind of difference(get(enchantment, "kinds", []), ENCHANT_KINDS)) {
						errors.push(`${path}: unknown enchantment kind ${pyStr(kind)}`);
					}
				}
			}
		}

		const coverageError = checkCoverage(name, entriesOf(outs).map(([, x]) => x), pets);
		if (coverageError) {
			errors.push(coverageError);
		}
	}

	if (total && conditional / total < 0.4) {
		warnings.push(`only ${conditional}/${total} outcomes are conditional (rewritten events: about 3/4)`);
	}
	const originalTotal = entriesOf(origPossibilities).reduce((sum, [, possibility]) => sum + keysOf(need(possibility, "outcomes")).length, 0);
	if (total <= originalTotal) {
		warnings.push(`${total} outcomes, not more than the original`);
	}

	// --- icons ---
	const icons = truthy(get(out, "icons")) ? out.icons : {};
	for (const name of difference(difference(keysOf(tp), keysOf(origPossibilities)), ["end"])) {
		if (!truthy(get(icons, name))) {
			errors.push(`icons: missing emoji for new possibility ${name}`);
		}
	}
	const newEnd = difference(keysOf(get(get(tp, "end", {}), "outcomes", {})), keysOf(get(get(origPossibilities, "end", {}), "outcomes", {})));
	for (const outcome of newEnd) {
		const endIcons = truthy(get(icons, "end")) ? icons.end : {};
		if (!truthy(get(endIcons, outcome))) {
			errors.push(`icons: missing emoji for new end outcome ${outcome}`);
		}
	}
	if (!truthy(get(out, "notes"))) {
		warnings.push("notes: missing");
	}
	return {
		errors, warnings, total, conditional
	};
}

/**
 * Coverage: every player profile must have at least one valid outcome of the possibility
 * @param {string} name possibility
 * @param {any[]} outs outcomes of the possibility
 * @param {Map<number, {rarity: number}>} pets
 * @returns {string | null} the error for the first uncovered profile
 */
function checkCoverage(name, outs, pets) {
	const values = (key, defaults) => {
		const found = new Set(defaults);
		for (const x of outs) {
			const requirements = truthy(get(x, "requirements")) ? x.requirements : {};
			const range = truthy(get(requirements, key)) ? requirements[key] : {};
			for (const bound of ["min", "max"]) {
				const value = get(range, bound);
				if (value !== null) {
					found.add(value).add(value - 1)
						.add(value + 1);
				}
			}
		}
		return [...found].sort(byNumber);
	};
	const reqs = outs.map(x => {
		const requirements = truthy(get(x, "requirements")) ? { ...x.requirements } : {};
		if (Object.hasOwn(x, "consumeMaterials")) {
			requirements.materials = { quantity: { min: need(x.consumeMaterials, "quantity") } };
		}
		return requirements;
	});
	const classes = [...new Set([...reqs.flatMap(r => get(r, "validClassIds", [])), 0])].sort(byNumber);
	const listedPets = [...new Set(reqs.flatMap(r => get(r, "validPetTypeIds", [])))].sort(byNumber);
	const petProfiles = [
		null,
		...listedPets.filter(id => pets.has(id)).map(id => [id, pets.get(id).rarity]),
		...values("petRarity", [1, 8]).filter(rarity => rarity >= 1 && rarity <= 8)
			.map(rarity => [-1, rarity])
	];
	const uses = key => reqs.some(r => Object.hasOwn(r, key));

	// Extra dimensions only vary when an outcome uses them; materials and enchantment: the player has none, or has everything
	const dims = [
		values("level", [1, 200]), values("karma", [-500, 0, 500]), values("health", [1, 1000]), values("attack", [0, 2000]),
		values("defense", [0, 2000]), values("speed", [0, 2000]), classes, petProfiles,
		uses("cookingLevel") ? values("cookingLevel", [0, 100]) : [0],
		uses("weaponLevel") ? values("weaponLevel", [0, 10]) : [0],
		uses("armorLevel") ? values("armorLevel", [0, 10]) : [0],
		uses("materials") ? [false, true] : [true],
		uses("enchantment") ? [false, true] : [true]
	];

	const ok = (r, [level, karma, health, attack, defense, speed, cls, pet, cooking, weaponLevel, armorLevel, hasMaterials, hasEnchantment]) => {
		for (const [key, value] of [["cookingLevel", cooking], ["weaponLevel", weaponLevel], ["armorLevel", armorLevel]]) {
			if (!inRange(get(r, key), Math.max(value, 0))) {
				return false;
			}
		}
		if (Object.hasOwn(r, "materials")) {
			const quantity = get(r.materials, "quantity");
			if (!inRange(truthy(quantity) ? quantity : { min: 1 }, hasMaterials ? 10 ** 6 : 0)) {
				return false;
			}
		}
		if (Object.hasOwn(r, "enchantment") && !hasEnchantment) {
			return false;
		}
		for (const [key, value] of [["level", level], ["karma", karma], ["health", health], ["attack", attack], ["defense", defense], ["speed", speed]]) {
			const range = get(r, key);
			if (truthy(range) && (get(range, "min") !== null && value < range.min || get(range, "max") !== null && value > range.max)) {
				return false;
			}
		}
		if (Object.hasOwn(r, "validClassIds") && !r.validClassIds.includes(cls)) {
			return false;
		}
		if (Object.hasOwn(r, "validPetTypeIds") && (pet === null || !r.validPetTypeIds.includes(pet[0]))) {
			return false;
		}
		if (Object.hasOwn(r, "petRarity")) {
			const range = r.petRarity;
			if (pet === null || get(range, "min") !== null && pet[1] < range.min || get(range, "max") !== null && pet[1] > range.max) {
				return false;
			}
		}
		return !Object.hasOwn(r, "campaignCurrentMissionId");
	};

	if (outs.length === 0) {
		return null;
	}

	// Cartesian product of the dimensions, the last one varying fastest (itertools.product)
	const indexes = dims.map(() => 0);
	for (;;) {
		const profile = dims.map((dim, i) => dim[indexes[i]]);
		if (!reqs.some(r => ok(r, profile))) {
			const [level, karma, health, attack, defense, speed, cls, pet, cooking, weaponLevel, armorLevel, hasMaterials, hasEnchantment] = profile;
			return `${name}: no valid outcome for level=${level} karma=${karma} health=${health} attack=${attack} defense=${defense} speed=${speed} class=${cls} pet=${pet === null ? "None" : `(${pet[0]}, ${pet[1]})`}`
				+ ` cooking=${cooking} weaponLevel=${weaponLevel} armorLevel=${armorLevel} materials=${hasMaterials ? "oui" : "aucun"} enchantment=${hasEnchantment ? "oui" : "aucun"}`;
		}
		let i = dims.length - 1;
		while (i >= 0 && ++indexes[i] === dims[i].length) {
			indexes[i--] = 0;
		}
		if (i < 0) {
			return null;
		}
	}
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
