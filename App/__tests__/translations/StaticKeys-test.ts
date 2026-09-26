declare const __dirname: string;

interface DirectoryEntry {
	name: string;
	isDirectory(): boolean;
}

const fs = jest.requireActual<{
	readdirSync(directory: string, options: {withFileTypes: true}): DirectoryEntry[];
	readFileSync(file: string, encoding: "utf8"): string;
}>("node:fs");
const path = jest.requireActual<{
	join(...paths: string[]): string;
	resolve(...paths: string[]): string;
	relative(from: string, to: string): string;
}>("node:path");

interface TranslationKeyUsage {
	file: string;
	line: number;
	key: string;
}

const SOURCE_DIRECTORIES = ["src", "app"] as const;
const KEY_CALL = /\bi18n\.(?:t|tArray|tRecord)\(\s*(["'`])([^"'`]+)\1/g;
const I18NEXT_SUFFIXES = ["_one", "_other", "_zero", "_plural"] as const;

function sourceFiles(directory: string): string[] {
	return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			return sourceFiles(entryPath);
		}
		return /\.tsx?$/.test(entry.name) ? [entryPath] : [];
	});
}

function translationAtPath(namespace: Record<string, unknown>, key: string): boolean {
	const segments = key.split(".");
	let current: unknown = namespace;
	for (const [index, segment] of segments.entries()) {
		if (typeof current !== "object" || current === null || Array.isArray(current)) {
			return false;
		}
		const entries = current as Record<string, unknown>;
		const candidates = index === segments.length - 1
			? [segment, ...I18NEXT_SUFFIXES.map(suffix => `${segment}${suffix}`)]
			: [segment];
		const matched = candidates.find(candidate => Object.hasOwn(entries, candidate))
			?? (index === segments.length - 1 ? Object.keys(entries).find(candidate => candidate.startsWith(`${segment}_`)) : undefined);
		if (matched === undefined) {
			return false;
		}
		current = entries[matched];
	}
	return true;
}

function missingTranslationKeys(): TranslationKeyUsage[] {
	const appRoot = path.resolve(__dirname, "../..");
	const repositoryRoot = path.resolve(appRoot, "..");
	const frenchRoot = path.join(repositoryRoot, "Lang", "fr");
	const missing: TranslationKeyUsage[] = [];

	for (const directory of SOURCE_DIRECTORIES) {
		for (const file of sourceFiles(path.join(appRoot, directory))) {
			const source = fs.readFileSync(file, "utf8");
			KEY_CALL.lastIndex = 0;
			for (const match of source.matchAll(KEY_CALL)) {
				const [namespaceName, ...keyParts] = match[2].split(":");
				if (keyParts.length === 0 || keyParts.join(":").includes("${")) {
					continue;
				}

				const namespacePath = path.join(frenchRoot, `${namespaceName}.json`);
				let namespace: Record<string, unknown> | null = null;
				try {
					namespace = JSON.parse(fs.readFileSync(namespacePath, "utf8")) as Record<string, unknown>;
				}
				catch {
					namespace = null;
				}
				if (!namespace || !translationAtPath(namespace, keyParts.join(":"))) {
					const line = source.slice(0, match.index).split("\n").length;
					missing.push({file: path.relative(repositoryRoot, file), line, key: match[2]});
				}
			}
		}
	}

	return missing;
}

describe("static French translation keys", () => {
	it("defines every literal i18n key used by the app", () => {
		const missing = missingTranslationKeys();
		expect(missing.map(({file, line, key}) => `${file}:${line} ${key}`).join("\n")).toBe("");
	});
});