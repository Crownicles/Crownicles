/**
 * Checks that the text of each outcome agrees with its mechanics, drawn from the reviews of the rewritten events
 */
import { entriesOf } from "./common.mjs";
import { get, getOrEmpty } from "./python.mjs";

const SMALL_INJURY_EFFECTS = new Set(["hurt", "injured", "confounded"]);
const DOG_IDS = [1, 2];
const MAX_DOG_OUTCOMES = 2;
const TAG_LIST_MIN_LENGTH = 4;

// Minutes an alteration keeps the player busy; occupied lasts lostTime (reference.md)
const EFFECT_MINUTES = {
	sleeping: 180, drunk: 240, freezing: 60, feetHurt: 110, hurt: 300, sick: 330, jailed: 1440, injured: 660,
	starving: 50, confounded: 40, scared: 15, lost: 270, fished: 5, working: 75, burning: 25
};

/**
 * Minutes the outcome keeps the player busy: the lost time, or the duration of the alteration
 * @param {any} x outcome data
 * @returns {number}
 */
const busyMinutes = x => Math.max(x.lostTime ?? 0, EFFECT_MINUTES[x.effect] ?? 0);

// A strong attack or defense can only come from real equipment: "fort" on the scale of reference.md
const ATTACK_WITH_WEAPON = 600;
const DEFENSE_WITH_ARMOR = 520;
const WEAPON_WORDS = /(?:[Vv]otre|[Vv]os) (?:arme|épée|lame|pioche|hache|marteau|masse|arc|dague|couteau)(?!\p{L})/u;
const ARMOR_WORDS = /(?:[Vv]otre|[Vv]os) (?:armure|bouclier|cotte|casque)(?!\p{L})/u;

/**
 * Whether the requirements guarantee that the player really carries a weapon (or an armor)
 * @param {object} req requirements
 * @param {"weapon" | "armor"} slot
 * @returns {boolean}
 */
function isEquipmentGuaranteed(req, slot) {
	const [stat, threshold, level] = slot === "weapon" ? ["attack", ATTACK_WITH_WEAPON, "weaponLevel"] : ["defense", DEFENSE_WITH_ARMOR, "armorLevel"];
	return (slot === "weapon" && Object.hasOwn(req, "weaponTags"))
		|| (get(get(req, stat, {}), "min") ?? 0) >= threshold
		|| (get(get(req, level, {}), "min") ?? 0) >= 1
		|| get(get(req, "enchantment", {}), "slot") === slot;
}

/**
 * Text/mechanics rules of an outcome: each one warns when its test matches
 * @type {{test: (text: string, x: any) => boolean, message: string}[]}
 */
const OUTCOME_RULES = [
	{
		test: (_, x) => x.effect === "hurt" && x.health < 0 && x.health > -16,
		message: "hurt for a small injury: confounded (étourdi) fits better"
	},
	{
		test: (_, x) => SMALL_INJURY_EFFECTS.has(x.effect) && x.health < 0 && x.health > -6,
		message: "an alteration for a scratch: no effect fits better"
	},
	{
		test: (text, x) => /sans armure/u.test(text) && Object.hasOwn(getOrEmpty(x, "requirements"), "defense"),
		message: "\"sans armure\" for a defense range: the player has an armor, say \"sans bonne armure\""
	},
	{
		test: (text, x) => /sans arme(?!\p{L})/u.test(text) && Object.hasOwn(getOrEmpty(x, "requirements"), "attack"),
		message: "\"sans arme\" for an attack range: the player has a weapon, say \"sans arme digne de ce nom\""
	},
	{
		test: (text, x) => /des heures/u.test(text) && busyMinutes(x) < 90,
		message: "\"des heures\" for less than 90 minutes lost"
	},
	{
		test: (text, x) => /bien plus longtemps/u.test(text) && busyMinutes(x) < 120,
		message: "\"bien plus longtemps\" for less than 2 hours lost: \"plus longtemps que prévu\""
	},
	{
		test: (text, x) => WEAPON_WORDS.test(text) && !isEquipmentGuaranteed(getOrEmpty(x, "requirements"), "weapon"),
		message: "names the player's weapon without a condition that guarantees one (weaponTags, attack min 600, weaponLevel, weapon enchantment): the player may fight bare-handed"
	},
	{
		test: (text, x) => ARMOR_WORDS.test(text) && !isEquipmentGuaranteed(getOrEmpty(x, "requirements"), "armor"),
		message: "names the player's armor without a condition that guarantees one (defense min 520, armorLevel, armor enchantment)"
	},
	{
		test: (_, x) => x.goBackToPreviousMap === true && !Array.isArray(x.mapTypesDestination),
		message: "goBackToPreviousMap without mapTypesDestination: no destination when the U-turn is impossible"
	}
];

/**
 * Whether every pet of a long id list shares a tag, so that petTags would say the same thing
 * @param {number[]} ids
 * @param {Map<number, {tags: string[]}>} pets
 * @returns {string | undefined} the shared tag
 */
function sharedTag(ids, pets) {
	if (ids.length < TAG_LIST_MIN_LENGTH) {
		return undefined;
	}
	const [first, ...others] = ids.map(id => pets.get(id)?.tags ?? []);
	return first.find(tag => others.every(tags => tags.includes(tag)));
}

/**
 * Check one outcome: its text against its mechanics, and its pet list against the pet tags
 * @param {{errors: string[], warnings: string[]}} report
 * @param {string} path
 * @param {[string, any]} outcome text and data
 * @param {Map<number, {tags: string[]}>} pets
 */
function checkOutcomeConsistency(report, path, [text, x], pets) {
	for (const rule of OUTCOME_RULES.filter(outcomeRule => outcomeRule.test(text, x))) {
		report.warnings.push(`${path}: ${rule.message}`);
	}
	const tag = sharedTag(get(getOrEmpty(x, "requirements"), "validPetTypeIds", []), pets);
	if (tag) {
		report.warnings.push(`${path}: every listed pet has the tag ${tag}: use "petTags": ["${tag}"]`);
	}
}

/**
 * Check that the texts agree with the mechanics, and that the event does not lean on dogs
 * @param {{errors: string[], warnings: string[]}} report
 * @param {any} out writer output
 * @param {Map<number, {tags: string[]}>} pets
 */
export function checkConsistency(report, out, pets) {
	const tp = get(out, "possibilities", {});
	let dogOutcomes = 0;
	for (const [name, possibility] of entriesOf(get(getOrEmpty(out, "data"), "possibilities", {}))) {
		for (const [id, x] of entriesOf(get(possibility, "outcomes", {}))) {
			const text = get(get(get(tp, name, {}), "outcomes", {}), id, "");
			checkOutcomeConsistency(report, `${name}.outcomes.${id}`, [typeof text === "string" ? text : "", x], pets);
			const petIds = get(getOrEmpty(x, "requirements"), "validPetTypeIds", []);
			dogOutcomes += petIds.length > 0 && petIds.every(petId => DOG_IDS.includes(petId)) ? 1 : 0;
		}
	}
	if (dogOutcomes > MAX_DOG_OUTCOMES) {
		report.warnings.push(`${dogOutcomes} outcomes for dogs only: other pets have a nose too (petTags keenNose)`);
	}
}
