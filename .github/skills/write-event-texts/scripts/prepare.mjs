/**
 * Build the workshop input of a big event: <work>/input/<id>.json.
 *
 * Usage:
 *   node prepare.mjs <event id> [--draft-ref <git ref>] [--model <name>] [--bible <path>] [--work <dir>]
 *
 * original = the version of origin/develop, draft = the version at --draft-ref (a contributor's draft to rework), if given.
 * The canon block of the place comes from Annex A of the lore bible: --bible, or the file of the Crownicles/Tools repository.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
	entriesOf, listJsonFiles, ordered, parseJson, readJson, REPO_ROOT, setKey, stringifyJson, workDirectory, writeFile
} from "./common.mjs";

const BIBLE_URL = "https://raw.githubusercontent.com/Crownicles/Tools/master/documents/crownicles-lore-proposition.md";

/**
 * Read a JSON file of the repository at a git ref
 * @param {string} ref
 * @param {string} path
 * @returns {any}
 */
function gitJson(ref, path) {
	return parseJson(execFileSync("git", ["-C", REPO_ROOT, "show", `${ref}:${path}`], { encoding: "utf8", maxBuffer: 1 << 30 }));
}

/**
 * Value of a key that must exist (Python's dict[key])
 * @param {object} object
 * @param {string} key
 * @returns {any}
 */
function need(object, key) {
	if (!Object.hasOwn(object, key)) {
		throw new Error(`KeyError: '${key}'`);
	}
	return object[key];
}

/**
 * Text of the lore bible, or null with a warning when it cannot be read
 * @param {string | undefined} path
 * @returns {Promise<string | null>}
 */
async function readBible(path) {
	try {
		if (path) {
			return readFileSync(path, "utf8");
		}
		const response = await fetch(BIBLE_URL);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		return await response.text();
	}
	catch (error) {
		console.warn(`warning: cannot read the lore bible (${path ?? BIBLE_URL}: ${error.message}), canonBlock left empty`);
		return null;
	}
}

/**
 * Canon block of a place in Annex A of the lore bible ("#### <name> · `<id>`" up to the next heading)
 * @param {string | null} bible
 * @param {string} name
 * @param {number} mapId
 * @returns {string}
 */
function canonBlock(bible, name, mapId) {
	const match = bible?.match(new RegExp(`#### ${RegExp.escape(name)} · \`${mapId}\`.*?(?=\\n#### |\\n## |<!-- canon:end)`, "s"));
	return match ? match[0] : "";
}

/**
 * @param {string[]} argv
 * @returns {Promise<number>} exit code
 */
async function main(argv) {
	const { values: options, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			"draft-ref": { type: "string" },
			"model": { type: "string", default: "" },
			"bible": { type: "string" },
			"work": { type: "string" }
		}
	});
	if (positionals.length !== 1) {
		console.error("Usage: node prepare.mjs <event id> [--draft-ref <git ref>] [--model <name>] [--bible <path>] [--work <dir>]");
		return 2;
	}
	const [eventId] = positionals;
	const draftRef = options["draft-ref"];

	const devData = gitJson("origin/develop", `Core/resources/events/${eventId}.json`);
	const devLang = need(gitJson("origin/develop", "Lang/fr/events.json"), eventId);
	const locations = readJson(join(REPO_ROOT, "Lang/fr/models.json")).map_locations;
	const trigger = devData.triggers.find(t => Object.hasOwn(t, "mapId"));
	if (!trigger) {
		throw new Error(`event ${eventId} has no trigger with a mapId`);
	}
	const mapId = trigger.mapId;
	const place = readJson(join(REPO_ROOT, `Core/resources/mapLocations/${mapId}.json`));
	const neighbours = [];
	for (const file of listJsonFiles(join(REPO_ROOT, "Core/resources/mapLinks"))) {
		const link = readJson(file);
		if (link.startMap === mapId) {
			const end = link.endMap;
			neighbours.push(ordered([
				["mapId", end],
				["name", need(locations, String(end)).name],
				["minutes", link.tripDuration],
				["type", readJson(join(REPO_ROOT, `Core/resources/mapLocations/${end}.json`)).type]
			]));
		}
	}
	neighbours.sort((a, b) => a.minutes - b.minutes);
	const city = listJsonFiles(join(REPO_ROOT, "Core/resources/cities"))
		.map(file => readJson(file))
		.find(c => (c.maps ?? []).includes(mapId)) ?? null;
	const location = need(locations, String(mapId));

	const out = ordered([
		["eventId", eventId],
		["model", options.model],
		["mapId", mapId],
		["place", location.name],
		["placeType", place.type],
		["placeDescription", location.description],
		["neighbours", neighbours],
		["isCity", city !== null],
		["city", city],
		["canonBlock", canonBlock(await readBible(options.bible), location.name, mapId)],
		["triggers", devData.triggers],
		["original", devLang],
		["outcomeData", ordered(entriesOf(devData.possibilities).map(([name, possibility]) => [name, possibility.outcomes]))]
	]);
	if (draftRef) {
		setKey(out, "draft", ordered([
			["author", spawnSync("git", ["-C", REPO_ROOT, "log", "-1", "--format=%an", draftRef], { encoding: "utf8" }).stdout.trim()],
			["lang", need(gitJson(draftRef, "Lang/fr/events.json"), eventId)],
			["data", gitJson(draftRef, `Core/resources/events/${eventId}.json`)]
		]));
	}
	writeFile(join(workDirectory(options.work), "input", `${eventId}.json`), stringifyJson(out, 1));
	const bool = value => (value ? "True" : "False");
	console.log(`input/${eventId}.json: ${out.place} (${out.placeType}), ${neighbours.length} neighbours, city=${bool(out.isCity)}, draft=${bool(draftRef)}`);
	return 0;
}

process.exitCode = await main(process.argv.slice(2));
