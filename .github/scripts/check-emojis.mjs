/**
 * Fail when emojis are found in commit messages or in translation files.
 *
 * Usage:
 *   node check-emojis.mjs commits <base_sha> <head_sha>
 *   node check-emojis.mjs translations <directory>
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/*
 * Pictographs with a text presentation by default that are commonly used as plain typography.
 * They are only reported when the emoji variation selector (U+FE0F) forces their emoji rendering.
 */
const TEXT_SYMBOLS = "\u00A9\u00AE\u2122\u203C\u2049\u2194-\u2199\u21A9\u21AA";

const EMOJI_PATTERN = new RegExp(
	`[\\p{Extended_Pictographic}--[${TEXT_SYMBOLS}]]|[${TEXT_SYMBOLS}]\\uFE0F|\\p{Regional_Indicator}|\\uFE0F?\\u20E3`,
	"gv"
);

export function findEmojis(text) {
	return [...new Set(text.match(EMOJI_PATTERN) ?? [])].sort();
}

export function findEmojisInJson(value, path = []) {
	if (typeof value === "string") {
		const emojis = findEmojis(value);
		return emojis.length > 0 ? [{ path, emojis }] : [];
	}
	if (value !== null && typeof value === "object") {
		return Object.entries(value).flatMap(([key, child]) => findEmojisInJson(child, [...path, key]));
	}
	return [];
}

function checkCommits(base, head) {
	const log = execFileSync("git", ["log", "--no-merges", "--format=%H%x00%B%x1e", `${base}..${head}`], { encoding: "utf8" });
	const offenders = log.split("\x1e")
		.filter(entry => entry.trim())
		.map(entry => {
			const [sha, message] = entry.trim().split("\x00");
			return { sha, subject: message.trim().split("\n")[0], emojis: findEmojis(message) };
		})
		.filter(commit => commit.emojis.length > 0);

	for (const { sha, subject, emojis } of offenders) {
		console.log(`::error title=Emoji in commit message::${sha.slice(0, 10)} "${subject}" contains ${emojis.join(" ")}`);
	}
	if (offenders.length > 0) {
		console.log(`\n${offenders.length} commit(s) contain emojis. Please reword them (git rebase -i) without emojis.`);
		return 1;
	}
	console.log("No emoji found in the commit messages.");
	return 0;
}

function listJsonFiles(directory) {
	return readdirSync(directory, { recursive: true })
		.filter(file => file.endsWith(".json"))
		.map(file => join(directory, file))
		.sort();
}

/*
 * Escaped emojis (\uD83D\uDE00) do not appear literally in the source,
 * so the line of the key is reported when the emoji itself cannot be found
 */
function findLine(lines, path, emojis) {
	const lastKey = JSON.stringify(path.at(-1) ?? "");
	const index = lines.findIndex(line => emojis.some(emoji => line.includes(emoji)));
	return (index !== -1 ? index : Math.max(lines.findIndex(line => line.includes(`${lastKey}:`)), 0)) + 1;
}

function checkTranslations(directory) {
	const files = listJsonFiles(directory);
	let offenders = 0;
	for (const file of files) {
		const content = readFileSync(file, "utf8");
		const lines = content.split("\n");
		for (const { path, emojis } of findEmojisInJson(JSON.parse(content))) {
			offenders++;
			console.log(`::error file=${file},line=${findLine(lines, path, emojis)},title=Hardcoded emoji::${path.join(".")} contains ${emojis.join(" ")}, use an {emote:...} interpolation instead`);
		}
	}
	if (offenders > 0) {
		console.log(`\n${offenders} translation(s) contain hardcoded emojis. Use {emote:path} interpolations with CrowniclesIcons instead.`);
		return 1;
	}
	console.log(`No emoji found in ${files.length} translation file(s).`);
	return 0;
}

function main([command, ...args]) {
	if (command === "commits" && args.length === 2) {
		return checkCommits(...args);
	}
	if (command === "translations" && args.length === 1) {
		return checkTranslations(args[0]);
	}
	console.log("Usage: check-emojis.mjs commits <base_sha> <head_sha> | translations <directory>");
	return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = main(process.argv.slice(2));
}
