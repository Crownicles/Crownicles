/**
 * Print a Markdown summary of the coverage or mutation reports, appended to the GitHub job summary when available.
 *
 * Usage:
 *   node test-reports-summary.mjs coverage <module>...
 *   node test-reports-summary.mjs mutation <module>... [--min-file-score <percent>]
 *
 * With --min-file-score, the mutation summary fails when the score of a mutated file is under the given floor.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

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

/**
 * Mutation score of every file of a Stryker JSON report, null when no mutant of the file is valid
 */
export function fileMutationScores(report) {
	return Object.entries(report.files).map(([file, { mutants }]) => {
		const valid = mutants.filter(mutant => !INVALID_STATUSES.includes(mutant.status));
		const count = status => valid.filter(mutant => mutant.status === status).length;
		const detected = valid.filter(mutant => DETECTED_STATUSES.includes(mutant.status)).length;
		return {
			file,
			score: valid.length === 0 ? null : 100 * detected / valid.length,
			killed: count("Killed"),
			timeout: count("Timeout"),
			survived: count("Survived"),
			noCoverage: count("NoCoverage")
		};
	});
}

/**
 * Files whose mutation score is under the floor
 */
export function filesUnderFloor(scores, minFileScore) {
	return scores.filter(({ score }) => score !== null && score < minFileScore);
}

function mutationScoresOf(module) {
	const report = readJson(join(module, "reports", "mutation", "mutation.json"));
	return report ? fileMutationScores(report).map(score => ({ ...score, file: `${module}/${score.file}` })) : null;
}

function mutationSummary(modules, minFileScore) {
	const lines = [
		"### Mutation score",
		"",
		"| File | Score | Killed | Timeout | Survived | No coverage |",
		"|---|---|---|---|---|---|"
	];
	const scores = [];
	for (const module of modules) {
		const moduleScores = mutationScoresOf(module);
		if (!moduleScores) {
			lines.push(`| ${module} | n/a | | | | |`);
			continue;
		}
		scores.push(...moduleScores);
		lines.push(...moduleScores.map(({ file, score, killed, timeout, survived, noCoverage }) =>
			`| ${file} | ${score === null ? "n/a" : `${score.toFixed(2)} %`} | ${killed} | ${timeout} | ${survived} | ${noCoverage} |`));
	}
	if (minFileScore === null) {
		return {
			lines, failed: false
		};
	}
	const under = filesUnderFloor(scores, minFileScore);
	lines.push("", under.length === 0
		? `Every mutated file reaches the floor of ${minFileScore} %.`
		: `**${under.length} file(s) under the floor of ${minFileScore} %**: ${under.map(({ file }) => file).join(", ")}. Kill their surviving mutants, or justify the equivalent ones with a \`// Stryker disable next-line <mutator>: <reason>\` comment.`);
	return {
		lines, failed: under.length > 0
	};
}

function main(argv) {
	const [kind, ...rest] = argv;
	const floorIndex = rest.indexOf("--min-file-score");
	const minFileScore = floorIndex === -1 ? null : Number(rest[floorIndex + 1]);
	const modules = floorIndex === -1 ? rest : rest.filter((_, index) => index !== floorIndex && index !== floorIndex + 1);
	if (!["coverage", "mutation"].includes(kind) || modules.length === 0 || Number.isNaN(minFileScore)) {
		console.error("Usage: node test-reports-summary.mjs <coverage|mutation> <module>... [--min-file-score <percent>]");
		return 1;
	}

	const { lines, failed } = kind === "coverage"
		? {
			lines: [
				"### Unit test coverage",
				"",
				`| Module | ${COVERAGE_METRICS.join(" | ")} |`,
				`|---|${COVERAGE_METRICS.map(() => "---").join("|")}|`,
				...modules.map(coverageRow)
			],
			failed: false
		}
		: mutationSummary(modules, minFileScore);
	const summary = `${lines.join("\n")}\n`;
	console.log(summary);
	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
	}
	return failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = main(process.argv.slice(2));
}
