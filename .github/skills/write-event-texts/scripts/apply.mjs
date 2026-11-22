/**
 * Apply rewritten events to the repository.
 *
 * Usage:
 *   node apply.mjs [event id ...] [--work <dir>]   (default: every <work>/out/<id>.json)
 *
 * Writes, for each event:
 * - its texts in Lang/fr/events.json,
 * - its mechanics in Core/resources/events/<id>.json,
 * - the emoji of its new possibilities and new "end" outcomes in Lib/src/CrowniclesIcons.ts.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
	entriesOf, isObject, ordered, readJson, REPO_ROOT, setKey, stringifyJson, workDirectory
} from "./common.mjs";

/**
 * Rewrite a JSON file with the indentation and the trailing newline it already has
 * @param {string} path
 * @param {unknown} data
 */
function writeJson(path, data) {
	const raw = readFileSync(path, "utf8");
	const indent = raw.match(/\n([ \t]+)[^\t\n\v\f\r\x1c-\x1f \x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]/u)[1];
	writeFileSync(path, stringifyJson(data, indent.includes("\t") ? "\t" : indent.length) + (raw.endsWith("\n") ? "\n" : ""));
}

/**
 * Entry of an event in Lang/fr/events.json
 * @param {any} out writer output
 * @returns {object}
 */
function langEntry(out) {
	const possibilities = ordered();
	for (const [name, possibility] of entriesOf(out.possibilities)) {
		const value = ordered();
		if (possibility.text) {
			setKey(value, "text", possibility.text);
		}
		setKey(value, "outcomes", possibility.outcomes);
		setKey(possibilities, name, value);
	}
	return ordered([["text", out.text], ["possibilities", possibilities]]);
}

/**
 * Render the icons of an event the way CrowniclesIcons.ts writes them: keys sorted, "end" as an object
 * @param {string} eventId
 * @param {object} icons possibility -> emoji, end -> {outcome -> emoji}
 * @param {string} indent
 * @returns {string[]} lines
 */
function iconsBlock(eventId, icons, indent = "\t\t") {
	const lines = [`${indent}${eventId}: {`];
	const items = Object.entries(icons).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	items.forEach(([name, value], i) => {
		const comma = i < items.length - 1 ? "," : "";
		const ends = isObject(value) ? Object.entries(value) : null;
		if (ends?.length === 1) {
			// The repository's lint wants a short single-property object on one line
			const [[outcome, emoji]] = ends;
			lines.push(`${indent}\t${name}: { ${outcome}: "${emoji}" }${comma}`);
		}
		else if (ends) {
			lines.push(`${indent}\t${name}: {`);
			ends.sort(([a], [b]) => Number(a) - Number(b));
			ends.forEach(([outcome, emoji], j) => {
				lines.push(`${indent}\t\t${outcome}: "${emoji}"${j < ends.length - 1 ? "," : ""}`);
			});
			lines.push(`${indent}\t}${comma}`);
		}
		else {
			lines.push(`${indent}\t${name}: "${value}"${comma}`);
		}
	});
	lines.push(`${indent}}`);
	return lines;
}

/**
 * Parse an event block of CrowniclesIcons.ts (possibility -> emoji, end -> {outcome -> emoji})
 * @param {string[]} block
 * @returns {object}
 */
function parseIcons(block) {
	const icons = {};
	let body = block.slice(1, -1).join("\n");
	for (const [, name, content] of body.matchAll(/([\p{L}\p{N}_]+): \{([^}]*)\}/gu)) {
		icons[name] = Object.fromEntries([...content.matchAll(/(\p{Nd}+): "([^"]+)"/gu)].map(([, outcome, emoji]) => [outcome, emoji]));
	}
	body = body.replace(/[\p{L}\p{N}_]+: \{[^}]*\}/gu, "");
	for (const [, name, emoji] of body.matchAll(/([\p{L}\p{N}_]+): "([^"]+)"/gu)) {
		icons[name] = emoji;
	}
	return icons;
}

/**
 * Update the icons of an event in CrowniclesIcons.ts
 * @param {string} path
 * @param {string} eventId
 * @param {object} newIcons icons of the writer output
 * @param {object} possibilities possibilities of the event data
 */
function updateIcons(path, eventId, newIcons, possibilities) {
	const lines = readFileSync(path, "utf8").split("\n");

	// The second "events: {" block holds the big events (the first one is the type declaration)
	const start = lines.flatMap((line, i) => (line === "\tevents: {" ? [i] : []))[1];
	const head = lines.findIndex((line, i) => i >= start && line === `\t\t${eventId}: {`);
	if (start === undefined || head === -1) {
		throw new Error(`event ${eventId} not found in the big events of ${path}`);
	}
	const tail = lines.findIndex((line, i) => i >= head && /^\t\t\},?$/u.test(line));
	let icons = parseIcons(lines.slice(head, tail + 1));
	for (const [name, value] of entriesOf(newIcons)) {
		if (isObject(value)) {
			if (!Object.hasOwn(icons, name)) {
				icons[name] = {};
			}
			Object.assign(icons[name], Object.fromEntries(entriesOf(value)));
		}
		else {
			icons[name] = value;
		}
	}

	// Drop the emoji of possibilities and "end" outcomes the event no longer has
	icons = Object.fromEntries(Object.entries(icons).filter(([name]) => Object.hasOwn(possibilities, name)));
	if (isObject(icons.end)) {
		icons.end = Object.fromEntries(Object.entries(icons.end).filter(([outcome]) => Object.hasOwn(possibilities.end.outcomes, outcome)));
	}
	const block = iconsBlock(eventId, icons);
	block[block.length - 1] += lines[tail].endsWith(",") ? "," : "";
	lines.splice(head, tail + 1 - head, ...block);
	writeFileSync(path, lines.join("\n"));
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
	const outDirectory = join(workDirectory(options.work), "out");
	const ids = positionals.length > 0
		? positionals
		: readdirSync(outDirectory).filter(file => !file.startsWith(".") && file.endsWith(".json"))
			.map(file => file.slice(0, -".json".length))
			.sort();
	const langPath = join(REPO_ROOT, "Lang/fr/events.json");
	const lang = readJson(langPath);
	for (const eventId of ids) {
		const out = readJson(join(outDirectory, `${eventId}.json`));
		setKey(lang, eventId, langEntry(out));
		writeJson(join(REPO_ROOT, `Core/resources/events/${eventId}.json`), ordered([["possibilities", out.data.possibilities], ["triggers", out.data.triggers]]));
		updateIcons(join(REPO_ROOT, "Lib/src/CrowniclesIcons.ts"), eventId, out.icons || {}, out.data.possibilities);
		console.log(`${eventId}: applied`);
	}
	writeJson(langPath, lang);
	return 0;
}

process.exitCode = main(process.argv.slice(2));
