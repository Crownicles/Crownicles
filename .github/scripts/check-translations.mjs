/**
 * Keep every locale of Lang/ in sync with the French reference.
 *
 * Usage:
 *   node check-translations.mjs parity <lang_directory>
 *     Every locale has the same files and the same keys as French.
 *   node check-translations.mjs sync <lang_directory> <base_ref> [--allow-reference-only-edits]
 *     Every French string edited since <base_ref> is also updated in every other locale
 *     (unless --allow-reference-only-edits is given, for typo fixes that do not affect the other languages),
 *     and every string added or edited since <base_ref> keeps the placeholders of its French version.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const REFERENCE_LOCALE = "fr";

const REFERENCE_LOCALE_ONLY_LABEL = "no-translation-sync";

export const SYNC_ERRORS = {
	NOT_UPDATED: "notUpdated",
	PLACEHOLDERS: "placeholders"
};

/*
 * Interpolations that the code fills or resolves: {{variable}}, {emote:path}, {command:name} and $t(nested:key).
 * Formatting options are ignored so that "{{count, number}}" and "{{count}}" are the same placeholder.
 */
const PLACEHOLDER_PATTERN = /\{\{\s*([^,}\s]+)[^}]*\}\}|\{(?:emote|command):[^}]*\}|\$t\([^)]*\)/g;

/**
 * Flatten a translation file into "file:path.to.key" -> leaf value, arrays included (indexes become path segments)
 */
export function flattenTranslations(value, prefix, entries = new Map()) {
	if (value !== null && typeof value === "object") {
		for (const [key, child] of Object.entries(value)) {
			flattenTranslations(child, `${prefix}.${key}`, entries);
		}
	}
	else {
		entries.set(prefix, value);
	}
	return entries;
}

export function findPlaceholders(text) {
	if (typeof text !== "string") {
		return [];
	}
	return [...new Set([...text.matchAll(PLACEHOLDER_PATTERN)].map(match => match[1] !== undefined ? `{{${match[1]}}}` : match[0]))].sort();
}

function keysMissingFrom(source, target) {
	return [...source.keys()].filter(key => !target.has(key));
}

/**
 * @param locales locale -> flattened translations, the reference locale included
 */
export function findParityErrors(locales) {
	const reference = locales[REFERENCE_LOCALE];
	return Object.entries(locales)
		.filter(([locale]) => locale !== REFERENCE_LOCALE)
		.flatMap(([locale, translations]) => [
			...keysMissingFrom(reference, translations).map(key => ({ locale, key, message: `missing translation of "${key}"` })),
			...keysMissingFrom(translations, reference).map(key => ({ locale, key, message: `"${key}" does not exist in the ${REFERENCE_LOCALE} reference, remove it` }))
		]);
}

function isChanged(base, head, key) {
	return !base.has(key) || base.get(key) !== head.get(key);
}

function findNotUpdatedErrors({ locale, reference, referenceBase, translations, translationsBase }, key) {
	const referenceEdited = referenceBase.has(key) && isChanged(referenceBase, reference, key);
	const translationKept = translationsBase.has(key) && !isChanged(translationsBase, translations, key);
	return referenceEdited && translationKept
		? [{ kind: SYNC_ERRORS.NOT_UPDATED, locale, key, message: `"${key}" was edited in ${REFERENCE_LOCALE} but not in ${locale}` }]
		: [];
}

function findPlaceholderErrors({ locale, reference, referenceBase, translations, translationsBase }, key) {
	const touched = isChanged(referenceBase, reference, key) || isChanged(translationsBase, translations, key);
	if (!touched || !reference.has(key)) {
		return [];
	}
	const expected = findPlaceholders(reference.get(key)).join(" ");
	const actual = findPlaceholders(translations.get(key)).join(" ");
	return expected === actual
		? []
		: [{ kind: SYNC_ERRORS.PLACEHOLDERS, locale, key, message: `"${key}" uses placeholders [${actual}] but ${REFERENCE_LOCALE} uses [${expected}]` }];
}

/**
 * @param base locale -> flattened translations before the change
 * @param head locale -> flattened translations after the change
 */
export function findSyncErrors(base, head) {
	const reference = head[REFERENCE_LOCALE];
	const referenceBase = base[REFERENCE_LOCALE] ?? new Map();
	return Object.entries(head)
		.filter(([locale]) => locale !== REFERENCE_LOCALE)
		.flatMap(([locale, translations]) => {
			const context = { locale, reference, referenceBase, translations, translationsBase: base[locale] ?? new Map() };
			return [...translations.keys()].flatMap(key => [...findNotUpdatedErrors(context, key), ...findPlaceholderErrors(context, key)]);
		});
}

function loadLocales(listFiles, readFile) {
	const locales = {};
	for (const [locale, files] of Object.entries(listFiles())) {
		locales[locale] = new Map();
		for (const file of files) {
			const content = readFile(locale, file);
			if (content !== null) {
				flattenTranslations(JSON.parse(content), file.replace(/\.json$/, ""), locales[locale]);
			}
		}
	}
	return locales;
}

function listLocaleFiles(directory) {
	return Object.fromEntries(readdirSync(directory, { withFileTypes: true })
		.filter(entry => entry.isDirectory())
		.map(entry => [entry.name, readdirSync(join(directory, entry.name)).filter(file => file.endsWith(".json")).sort()]));
}

function loadWorkingTree(directory) {
	return loadLocales(() => listLocaleFiles(directory), (locale, file) => readFileSync(join(directory, locale, file), "utf8"));
}

function loadRevision(directory, ref, localeFiles) {
	return loadLocales(() => localeFiles, (locale, file) => {
		try {
			return execFileSync("git", ["show", `${ref}:${join(directory, locale, file)}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
		}
		catch {
			// The file did not exist yet at this revision
			return null;
		}
	});
}

function findFileErrors(localeFiles) {
	const referenceFiles = localeFiles[REFERENCE_LOCALE].join(" ");
	return Object.entries(localeFiles)
		.filter(([, files]) => files.join(" ") !== referenceFiles)
		.map(([locale, files]) => ({ locale, key: "", message: `has files [${files.join(", ")}] but ${REFERENCE_LOCALE} has [${referenceFiles.split(" ").join(", ")}]` }));
}

function report(directory, errors, title, hint) {
	for (const { locale, key, message } of errors) {
		const file = key ? `${join(directory, locale, key.split(".")[0])}.json` : join(directory, locale);
		console.log(`::error file=${file},title=${title}::${locale}: ${message}`);
	}
	if (errors.length > 0) {
		console.log(`\n${errors.length} translation problem(s). ${hint}`);
		return 1;
	}
	return 0;
}

function checkParity(directory) {
	const localeFiles = listLocaleFiles(directory);
	if (!localeFiles[REFERENCE_LOCALE]) {
		console.log(`No ${REFERENCE_LOCALE} reference locale in ${directory}`);
		return 2;
	}
	const errors = [...findFileErrors(localeFiles), ...findParityErrors(loadWorkingTree(directory))];
	if (errors.length === 0) {
		console.log(`All ${Object.keys(localeFiles).length} locales have the same keys as ${REFERENCE_LOCALE}.`);
	}
	return report(directory, errors, "Translation keys out of sync", `Every locale of ${directory} must have exactly the keys of ${REFERENCE_LOCALE}.`);
}

function checkSync(directory, baseRef, allowReferenceOnlyEdits) {
	const head = loadWorkingTree(directory);
	const base = loadRevision(directory, baseRef, listLocaleFiles(directory));
	const errors = findSyncErrors(base, head)
		.filter(error => !allowReferenceOnlyEdits || error.kind !== SYNC_ERRORS.NOT_UPDATED);
	if (errors.length === 0) {
		console.log(`Every translation edited since ${baseRef} is up to date in all locales.`);
	}
	return report(directory, errors, "Translation not updated", `When a ${REFERENCE_LOCALE} string changes, update it in every locale. If the change does not affect the other languages (typo, French-only wording), add the "${REFERENCE_LOCALE_ONLY_LABEL}" label to the pull request.`);
}

function main([command, ...args]) {
	if (command === "parity" && args.length === 1) {
		return checkParity(args[0]);
	}
	if (command === "sync" && (args.length === 2 || (args.length === 3 && args[2] === "--allow-reference-only-edits"))) {
		return checkSync(args[0], args[1], args.length === 3);
	}
	console.log("Usage: check-translations.mjs parity <lang_directory> | sync <lang_directory> <base_ref> [--allow-reference-only-edits]");
	return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = main(process.argv.slice(2));
}
