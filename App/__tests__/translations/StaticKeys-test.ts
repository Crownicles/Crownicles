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

function isEntries(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null) return false;
	return !Array.isArray(value);
}

type KeySegment = {name: string; last: boolean};

/** The last segment of a key may name a plural or context variant rather than the key itself. */
function lastSegmentMatch(entries: Record<string, unknown>, name: string): string | undefined {
	const exact = [name, ...I18NEXT_SUFFIXES.map(suffix => `${name}${suffix}`)].find(candidate => Object.hasOwn(entries, candidate));
	return exact ?? Object.keys(entries).find(candidate => candidate.startsWith(`${name}_`));
}

function segmentMatch(entries: Record<string, unknown>, segment: KeySegment): string | undefined {
	if (segment.last) return lastSegmentMatch(entries, segment.name);
	return Object.hasOwn(entries, segment.name) ? segment.name : undefined;
}

type StaticKey = {namespaceName: string; segments: readonly string[]};

function translationAtPath(namespace: Record<string, unknown>, {segments}: StaticKey): boolean {
	let current: unknown = namespace;
	for (const [index, name] of segments.entries()) {
		if (!isEntries(current)) return false;
		const matched = segmentMatch(current, {name, last: index === segments.length - 1});
		if (matched === undefined) return false;
		current = current[matched];
	}
	return true;
}

type TranslationRoots = {repositoryRoot: string; frenchRoot: string};

function readNamespace(roots: TranslationRoots, {namespaceName}: StaticKey): Record<string, unknown> | null {
	try {
		return JSON.parse(fs.readFileSync(path.join(roots.frenchRoot, `${namespaceName}.json`), "utf8")) as Record<string, unknown>;
	}
	catch {
		return null;
	}
}

/** A key built at runtime, or without a namespace, cannot be checked statically. */
function staticKey(fullKey: string): StaticKey | null {
	const [namespaceName, ...keyParts] = fullKey.split(":");
	const key = keyParts.join(":");
	return keyParts.length === 0 || key.includes("${") ? null : {namespaceName, segments: key.split(".")};
}

function missingKeysInFile(file: string, roots: TranslationRoots): TranslationKeyUsage[] {
	const source = fs.readFileSync(file, "utf8");
	KEY_CALL.lastIndex = 0;
	return [...source.matchAll(KEY_CALL)].flatMap(match => {
		const key = staticKey(match[2]);
		if (!key) return [];
		const namespace = readNamespace(roots, key);
		if (namespace && translationAtPath(namespace, key)) return [];
		const line = source.slice(0, match.index).split("\n").length;
		return [{file: path.relative(roots.repositoryRoot, file), line, key: match[2]}];
	});
}

function missingTranslationKeys(): TranslationKeyUsage[] {
	const appRoot = path.resolve(__dirname, "../..");
	const repositoryRoot = path.resolve(appRoot, "..");
	const roots = {repositoryRoot, frenchRoot: path.join(repositoryRoot, "Lang", "fr")};
	return SOURCE_DIRECTORIES
		.flatMap(directory => sourceFiles(path.join(appRoot, directory)))
		.flatMap(file => missingKeysInFile(file, roots));
}

describe("static French translation keys", () => {
	it("defines every literal i18n key used by the app", () => {
		const missing = missingTranslationKeys();
		expect(missing.map(({file, line, key}) => `${file}:${line} ${key}`).join("\n")).toBe("");
	});
});