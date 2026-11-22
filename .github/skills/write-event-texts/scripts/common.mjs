/**
 * Shared helpers of the event rewrite workshop (prepare.mjs, validate.mjs, apply.mjs).
 *
 * JSON objects keep the key order of their file, numeric keys included ("1", "10", "2"...),
 * which plain JSON.parse/JSON.stringify would sort: rewritten files stay identical to the originals.
 */
import {
	mkdirSync, opendirSync, readFileSync, writeFileSync
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const ORDER = Symbol("keyOrder");

/**
 * Work directory: <repo>/.event-rewrites by default, or the --work option (relative to the current directory)
 * @param {string | undefined} option value of --work
 * @returns {string}
 */
export function workDirectory(option) {
	return option ? resolve(option) : join(REPO_ROOT, ".event-rewrites");
}

/**
 * Set a key of a JSON object: an existing key keeps its place, a new key goes last
 * @param {object} object
 * @param {string} key
 * @param {unknown} value
 */
export function setKey(object, key, value) {
	if (object[ORDER] && !Object.hasOwn(object, key)) {
		object[ORDER].push(key);
	}
	object[key] = value;
}

/**
 * Create a JSON object keeping the given key order
 * @param {Iterable<[string, unknown]>} entries
 * @returns {object}
 */
export function ordered(entries = []) {
	const object = Object.create(null);
	Object.defineProperty(object, ORDER, { value: [] });
	for (const [key, value] of entries) {
		setKey(object, key, value);
	}
	return object;
}

/**
 * Keys of a JSON object in file order
 * @param {object} object
 * @returns {string[]}
 */
export function keysOf(object) {
	return object[ORDER] ? object[ORDER].filter(key => Object.hasOwn(object, key)) : Object.keys(object);
}

/**
 * Entries of a JSON object in file order
 * @param {object} object
 * @returns {[string, unknown][]}
 */
export function entriesOf(object) {
	return keysOf(object).map(key => [key, object[key]]);
}

/**
 * Whether a value is a JSON object (not an array, not null)
 * @param {unknown} value
 * @returns {boolean}
 */
export function isObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Parse JSON, keeping the key order of objects
 * @param {string} text
 * @returns {any}
 */
export function parseJson(text) {
	let position = 0;
	const fail = () => {
		throw new SyntaxError(`Invalid JSON at position ${position}`);
	};
	const skip = () => {
		while (position < text.length && " \t\n\r".includes(text[position])) {
			position++;
		}
	};
	const expect = char => {
		skip();
		if (text[position++] !== char) {
			fail();
		}
	};
	const literal = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;
	const parseString = () => {
		const start = position++;
		while (text[position] !== "\"") {
			if (position >= text.length) {
				fail();
			}
			position += text[position] === "\\" ? 2 : 1;
		}
		return JSON.parse(text.slice(start, ++position));
	};

	/**
	 * Parse the items of an object or an array up to the closing character
	 * @param {string} closing
	 * @param {() => void} parseItem
	 */
	const parseItems = (closing, parseItem) => {
		skip();
		if (text[position] === closing) {
			position++;
			return;
		}
		for (;;) {
			parseItem();
			skip();
			const next = text[position++];
			if (next === closing) {
				return;
			}
			if (next !== ",") {
				fail();
			}
		}
	};
	const parseValue = () => {
		skip();
		const char = text[position];
		if (char === "{") {
			position++;
			const object = ordered();
			parseItems("}", () => {
				skip();
				if (text[position] !== "\"") {
					fail();
				}
				const key = parseString();
				expect(":");
				setKey(object, key, parseValue());
			});
			return object;
		}
		if (char === "[") {
			position++;
			const array = [];
			parseItems("]", () => array.push(parseValue()));
			return array;
		}
		if (char === "\"") {
			return parseString();
		}
		literal.lastIndex = position;
		const match = literal.exec(text);
		if (!match) {
			fail();
		}
		position += match[0].length;
		return JSON.parse(match[0]);
	};
	const value = parseValue();
	skip();
	if (position < text.length) {
		fail();
	}
	return value;
}

/**
 * Serialize JSON like Python's json.dumps(value, ensure_ascii=False, indent=indent), in key order
 * @param {unknown} value
 * @param {string | number} indent a string, or a number of spaces
 * @param {string} padding current indentation
 * @returns {string}
 */
export function stringifyJson(value, indent, padding = "") {
	const unit = typeof indent === "number" ? " ".repeat(indent) : indent;
	const inner = padding + unit;
	if (Array.isArray(value)) {
		return value.length === 0
			? "[]"
			: `[\n${value.map(item => inner + stringifyJson(item, unit, inner)).join(",\n")}\n${padding}]`;
	}
	if (isObject(value)) {
		const keys = keysOf(value);
		return keys.length === 0
			? "{}"
			: `{\n${keys.map(key => `${inner}${JSON.stringify(key)}: ${stringifyJson(value[key], unit, inner)}`).join(",\n")}\n${padding}}`;
	}
	return JSON.stringify(value);
}

/**
 * Read a JSON file, keeping the key order of objects
 * @param {string} path
 * @returns {any}
 */
export function readJson(path) {
	return parseJson(readFileSync(path, "utf8"));
}

/**
 * Write a file, creating its directory
 * @param {string} path
 * @param {string} content
 */
export function writeFile(path, content) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content);
}

/**
 * The *.json files of a directory, in directory order (the order of Python's glob)
 * @param {string} directory
 * @returns {string[]} paths
 */
export function listJsonFiles(directory) {
	const dir = opendirSync(directory);
	const files = [];
	try {
		for (let entry = dir.readSync(); entry; entry = dir.readSync()) {
			if (!entry.name.startsWith(".") && entry.name.endsWith(".json")) {
				files.push(join(directory, entry.name));
			}
		}
	}
	finally {
		dir.closeSync();
	}
	return files;
}
