/**
 * Mark big events as reviewed by the owner: their rewrite is considered done.
 *
 * Usage:
 *   node review.mjs <event id ...>            mark the events as reviewed (today, with the fingerprint of their content)
 *   node review.mjs --remove <event id ...>   remove the mark
 *   node review.mjs --check                   list the reviewed events changed since their review (exits with 1 if any)
 *
 * The marks live in reviewed.json, next to this skill. The fingerprint covers the French texts and the mechanics of the
 * event, so the event rewrites viewer (Crownicles/Tools) shows a reviewed event changed afterwards as to review again.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { readJson, REPO_ROOT } from "./common.mjs";

const REVIEWED_PATH = join(REPO_ROOT, ".github/skills/write-event-texts/reviewed.json");

/**
 * JSON with sorted object keys, the same as stableJson in the viewer
 * @param {unknown} value
 * @returns {string}
 */
function stableJson(value) {
	return JSON.stringify(value, (key, x) => (x && typeof x === "object" && !Array.isArray(x)
		? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]]))
		: x));
}

/**
 * FNV-1a hash (32 bits) of the event texts and mechanics, computed the same way by the viewer
 * @param {unknown} lang the event in Lang/fr/events.json
 * @param {unknown} data Core/resources/events/<id>.json
 * @returns {string}
 */
export function eventFingerprint(lang, data) {
	const text = stableJson({ lang, data });
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, "0");
}

function currentFingerprint(id, lang) {
	return eventFingerprint(lang[id] ?? null, readJson(join(REPO_ROOT, `Core/resources/events/${id}.json`)));
}

function main(argv) {
	const { values, positionals } = parseArgs({
		args: argv, allowPositionals: true, options: { remove: { type: "boolean" }, check: { type: "boolean" } }
	});
	const reviewed = readJson(REVIEWED_PATH);
	const lang = readJson(join(REPO_ROOT, "Lang/fr/events.json"));
	if (values.check) {
		const changed = Object.keys(reviewed).filter(id => reviewed[id].fingerprint !== currentFingerprint(id, lang));
		console.log(changed.length ? `changed since their review: ${changed.join(", ")}` : `${Object.keys(reviewed).length} reviewed events, none changed`);
		return changed.length ? 1 : 0;
	}
	const today = new Date().toISOString().slice(0, 10);
	for (const id of positionals) {
		if (values.remove) {
			delete reviewed[id];
			continue;
		}
		if (!lang[id]) {
			console.error(`unknown event ${id}`);
			return 1;
		}
		reviewed[id] = { date: today, fingerprint: currentFingerprint(id, lang) };
	}
	const sorted = Object.fromEntries(Object.keys(reviewed).sort((a, b) => Number(a) - Number(b)).map(id => [id, reviewed[id]]));
	writeFileSync(REVIEWED_PATH, `${JSON.stringify(sorted, null, "\t")}\n`);
	console.log(`reviewed events: ${Object.keys(sorted).join(", ") || "none"}`);
	return 0;
}

process.exitCode = main(process.argv.slice(2));
