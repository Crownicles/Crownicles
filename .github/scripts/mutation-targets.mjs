/**
 * Print the `mutate` entries of the Stryker configuration of a module that a change touches, comma separated,
 * so that a pull request only mutates the files it changes among the ones already covered by mutation testing.
 *
 * Usage:
 *   node mutation-targets.mjs <module> <base_sha> <head_sha>
 */
import { execFileSync } from "node:child_process";
import { matchesGlob, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Entries of `mutate` matching one of the changed files, a file range ("file:12-40") being kept as is
 * @param mutate - The `mutate` entries of the Stryker configuration, relative to the module
 * @param changedFiles - Changed files, relative to the module
 */
export function selectMutationTargets(mutate, changedFiles) {
	const targets = [];
	for (const entry of mutate) {
		const pattern = entry.replace(/:\d+-\d+$/u, "");
		const matching = changedFiles.filter(file => file === pattern || matchesGlob(file, pattern));
		// A glob is narrowed to the changed files, an explicit file or range is kept as written
		targets.push(...(pattern.includes("*") ? matching : matching.length > 0 ? [entry] : []));
	}
	return [...new Set(targets)];
}

async function main([module, base, head]) {
	if (!module || !base || !head) {
		console.error("Usage: node mutation-targets.mjs <module> <base_sha> <head_sha>");
		return 1;
	}
	const { default: config } = await import(pathToFileURL(resolve(module, "stryker.config.mjs")).href);
	const changedFiles = execFileSync("git", ["diff", "--name-only", "--diff-filter=AM", base, head, "--", `${module}/src`], { encoding: "utf8" })
		.split("\n")
		.filter(Boolean)
		.map(file => file.slice(module.length + 1));
	console.log(selectMutationTargets(config.mutate, changedFiles).join(","));
	return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = await main(process.argv.slice(2));
}
