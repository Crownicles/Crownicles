/**
 * Fail when the lines a pull request adds to the source of the modules are not covered enough by the unit tests.
 * Lines that the coverage does not measure (types, comments, files excluded from the coverage) are ignored.
 *
 * Usage:
 *   node patch-coverage.mjs <base_sha> <head_sha> <min_percent> <module>...
 */
import { execFileSync } from "node:child_process";
import {
	appendFileSync, existsSync, readFileSync
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_ANNOTATIONS = 50;

/**
 * Hits of every measured line of every file of an lcov report, the paths being relative to the module
 * @returns {Map<string, Map<number, number>>}
 */
export function parseLcov(content) {
	const files = new Map();
	let current = null;
	for (const line of content.split("\n")) {
		if (line.startsWith("SF:")) {
			current = new Map();
			files.set(line.slice(3).trim(), current);
		}
		else if (line.startsWith("DA:") && current) {
			const [lineNumber, hits] = line.slice(3).split(",");
			current.set(Number(lineNumber), Number(hits));
		}
		else if (line.startsWith("end_of_record")) {
			current = null;
		}
	}
	return files;
}

/**
 * Path of the new version of a file from a "+++" header of a diff, null for a deleted file
 */
function newFilePath(header) {
	const path = header.slice(4).trim();
	return path === "/dev/null" ? null : path.replace(/^b\//u, "");
}

/**
 * Line numbers a hunk header ("@@ -a,b +c,d @@") adds, none when the line is not a hunk header
 */
function hunkAddedLines(line) {
	const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/u.exec(line);
	if (!hunk) {
		return [];
	}
	const start = Number(hunk[1]);
	const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
	return Array.from({ length: count }, (_, index) => start + index);
}

/**
 * Lines added by a `git diff --unified=0`, by file
 * @returns {Map<string, number[]>}
 */
export function parseAddedLines(diff) {
	const files = new Map();
	let current = null;
	for (const line of diff.split("\n")) {
		if (line.startsWith("+++ ")) {
			current = newFilePath(line);
			if (current !== null && !files.has(current)) {
				files.set(current, []);
			}
		}
		else if (current !== null) {
			files.get(current).push(...hunkAddedLines(line));
		}
	}
	return files;
}

/**
 * Lines of consecutive numbers grouped in ranges, for a readable report
 */
export function toRanges(lines) {
	const ranges = [];
	for (const line of [...lines].sort((a, b) => a - b)) {
		const last = ranges.at(-1);
		if (last && line === last[1] + 1) {
			last[1] = line;
		}
		else {
			ranges.push([line, line]);
		}
	}
	return ranges.map(([start, end]) => (start === end ? `${start}` : `${start}-${end}`));
}

/**
 * Coverage of the added lines measured by the coverage of their module
 * @param addedLines - Added lines by path relative to the repository
 * @param coverageByModule - Parsed lcov report of each module, its paths being relative to the module
 */
export function computePatchCoverage(addedLines, coverageByModule) {
	const files = [];
	for (const [path, lines] of addedLines) {
		const [module, ...rest] = path.split("/");
		const measured = coverageByModule.get(module)?.get(rest.join("/"));
		if (!measured) {
			continue;
		}
		const measuredLines = lines.filter(line => measured.has(line));
		if (measuredLines.length === 0) {
			continue;
		}
		files.push({
			path,
			total: measuredLines.length,
			uncovered: measuredLines.filter(line => measured.get(line) === 0)
		});
	}
	const total = files.reduce((sum, file) => sum + file.total, 0);
	const uncovered = files.reduce((sum, file) => sum + file.uncovered.length, 0);
	return {
		files,
		total,
		covered: total - uncovered,
		percent: total === 0 ? 100 : 100 * (total - uncovered) / total
	};
}

export function formatReport(result, minPercent) {
	const status = result.percent >= minPercent ? "passes" : "fails";
	const lines = [
		"### Coverage of the added lines",
		"",
		`**${result.covered}/${result.total} measured lines covered (${result.percent.toFixed(1)} %)**: the gate ${status}, its minimum is ${minPercent} %.`,
		""
	];
	if (result.files.length > 0) {
		lines.push("| File | Covered | Uncovered added lines |", "|---|---|---|");
		for (const file of result.files) {
			lines.push(`| ${file.path} | ${file.total - file.uncovered.length}/${file.total} | ${toRanges(file.uncovered).join(", ")} |`);
		}
		lines.push("");
	}
	if (status === "fails") {
		lines.push("Add unit tests for these lines. A change only testable by the integration tests can carry the `skip-patch-coverage` label, then rerun the job.", "");
	}
	return lines.join("\n");
}

function main([base, head, minPercentArgument, ...modules]) {
	const minPercent = Number(minPercentArgument);
	if (!base || !head || Number.isNaN(minPercent) || modules.length === 0) {
		console.error("Usage: node patch-coverage.mjs <base_sha> <head_sha> <min_percent> <module>...");
		return 1;
	}

	const diff = execFileSync("git", ["diff", "--unified=0", "--no-color", "--no-renames", base, head, "--", ...modules.map(module => `${module}/src`)], {
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024
	});
	const coverageByModule = new Map(modules.map(module => {
		const lcovPath = join(module, "coverage", "lcov.info");
		if (!existsSync(lcovPath)) {
			throw new Error(`Missing ${lcovPath}: run pnpm test:coverage in ${module} first`);
		}
		return [module, parseLcov(readFileSync(lcovPath, "utf8"))];
	}));

	const result = computePatchCoverage(parseAddedLines(diff), coverageByModule);
	const report = formatReport(result, minPercent);
	console.log(report);
	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
	}
	if (process.env.GITHUB_ACTIONS) {
		const annotations = result.files.flatMap(file => toRanges(file.uncovered).map(range => ({
			path: file.path, range
		})));
		for (const { path, range } of annotations.slice(0, MAX_ANNOTATIONS)) {
			const [start, end = start] = range.split("-");
			console.log(`::warning file=${path},line=${start},endLine=${end}::Added lines not covered by the unit tests`);
		}
	}
	return result.percent >= minPercent ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = main(process.argv.slice(2));
}
