/**
 * Print a Markdown summary of the coverage or mutation reports, appended to the GitHub job summary when available.
 *
 * Usage:
 *   node test-reports-summary.mjs coverage <module>...
 *   node test-reports-summary.mjs mutation <module>...
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const COVERAGE_METRICS = ["lines", "branches", "functions", "statements"];
const DETECTED_STATUSES = ["Killed", "Timeout"];
const INVALID_STATUSES = ["CompileError", "RuntimeError", "Ignored"];

function readJson(path) {
	return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

function coverageRow(module) {
	const report = readJson(join(module, "coverage", "coverage-summary.json"));
	if (!report) {
		return `| ${module} | ${COVERAGE_METRICS.map(() => "n/a").join(" | ")} |`;
	}
	const cells = COVERAGE_METRICS.map(metric => {
		const { pct, covered, total } = report.total[metric];
		return `${pct} % (${covered}/${total})`;
	});
	return `| ${module} | ${cells.join(" | ")} |`;
}

function mutationRows(module) {
	const report = readJson(join(module, "reports", "mutation", "mutation.json"));
	if (!report) {
		return [`| ${module} | n/a | | | |`];
	}
	return Object.entries(report.files).map(([file, { mutants }]) => {
		const valid = mutants.filter(mutant => !INVALID_STATUSES.includes(mutant.status));
		const detected = valid.filter(mutant => DETECTED_STATUSES.includes(mutant.status)).length;
		const survived = valid.filter(mutant => mutant.status === "Survived").length;
		const noCoverage = valid.filter(mutant => mutant.status === "NoCoverage").length;
		const score = valid.length === 0 ? "n/a" : `${(100 * detected / valid.length).toFixed(2)} %`;
		return `| ${module}/${file} | ${score} | ${detected} | ${survived} | ${noCoverage} |`;
	});
}

const TABLES = {
	coverage: modules => [
		"### Unit test coverage",
		"",
		`| Module | ${COVERAGE_METRICS.join(" | ")} |`,
		`|---|${COVERAGE_METRICS.map(() => "---").join("|")}|`,
		...modules.map(coverageRow)
	],
	mutation: modules => [
		"### Mutation score",
		"",
		"| File | Score | Killed | Survived | No coverage |",
		"|---|---|---|---|---|",
		...modules.flatMap(mutationRows)
	]
};

const [kind, ...modules] = process.argv.slice(2);
if (!TABLES[kind] || modules.length === 0) {
	console.error("Usage: node test-reports-summary.mjs <coverage|mutation> <module>...");
	process.exit(1);
}

const summary = `${TABLES[kind](modules).join("\n")}\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
	appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
}
