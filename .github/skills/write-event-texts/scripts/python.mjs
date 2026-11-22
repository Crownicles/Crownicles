/**
 * Python semantics of JSON values, so that the event checks behave like the original Python validator
 */
import {
	entriesOf, isObject, keysOf
} from "./common.mjs";

const REPR_ESCAPES = {
	"\\": "\\\\", "\n": "\\n", "\r": "\\r", "\t": "\\t", " ": " "
};

/**
 * Python's escape of a non printable character in repr()
 * @param {string} char
 * @returns {string}
 */
function escapeChar(char) {
	if (REPR_ESCAPES[char]) {
		return REPR_ESCAPES[char];
	}
	const code = char.codePointAt(0);
	if (code <= 0xff) {
		return `\\x${code.toString(16).padStart(2, "0")}`;
	}
	return code <= 0xffff ? `\\u${code.toString(16).padStart(4, "0")}` : `\\U${code.toString(16).padStart(8, "0")}`;
}

/**
 * Python's repr() of a string
 * @param {string} value
 * @returns {string}
 */
function stringRepr(value) {
	const quote = value.includes("'") && !value.includes("\"") ? "\"" : "'";
	const escaped = value.replace(/[\\\n\r\t]|[\p{C}\p{Z}]/gu, escapeChar);
	return quote + escaped.replaceAll(quote, `\\${quote}`) + quote;
}

/**
 * Python's repr() of a JSON value (sets are JS Sets)
 * @param {unknown} value
 * @returns {string}
 */
export function pyRepr(value) {
	if (value === null || value === undefined) {
		return "None";
	}
	if (typeof value === "boolean") {
		return value ? "True" : "False";
	}
	if (typeof value === "string") {
		return stringRepr(value);
	}
	if (value instanceof Set) {
		return value.size === 0 ? "set()" : `{${[...value].map(pyRepr).join(", ")}}`;
	}
	if (Array.isArray(value)) {
		return `[${value.map(pyRepr).join(", ")}]`;
	}
	if (isObject(value)) {
		return `{${entriesOf(value).map(([key, child]) => `${pyRepr(key)}: ${pyRepr(child)}`)
			.join(", ")}}`;
	}
	return String(value);
}

/**
 * Python's str() of a JSON value (what an f-string prints)
 * @param {unknown} value
 * @returns {string}
 */
export function pyStr(value) {
	return typeof value === "string" ? value : pyRepr(value);
}

/**
 * Python's truthiness of a JSON value
 * @param {unknown} value
 * @returns {boolean}
 */
export function truthy(value) {
	if (Array.isArray(value)) {
		return value.length > 0;
	}
	if (isObject(value)) {
		return keysOf(value).length > 0;
	}
	return Boolean(value);
}

/**
 * Python's dict.get(key)
 * @param {unknown} object
 * @param {string} key
 * @param {unknown} fallback
 * @returns {any}
 */
export function get(object, key, fallback = null) {
	return isObject(object) && Object.hasOwn(object, key) ? object[key] : fallback;
}

/**
 * Python's `dict.get(key) or {}`: the value when it is truthy, an empty object otherwise
 * @param {unknown} object
 * @param {string} key
 * @returns {any}
 */
export function getOrEmpty(object, key) {
	const value = get(object, key);
	return truthy(value) ? value : {};
}

/**
 * Python's dict[key]: a missing key is a KeyError
 * @param {object} object
 * @param {string} key
 * @returns {any}
 */
export function need(object, key) {
	if (!isObject(object) || !Object.hasOwn(object, key)) {
		throw new Error(`KeyError: ${pyRepr(key)}`);
	}
	return object[key];
}

/**
 * Python's int() of an outcome id
 * @param {string} text
 * @returns {number}
 */
export function pyInt(text) {
	if (!/^\s*[+-]?\d+(?:_\d+)*\s*$/u.test(text)) {
		throw new Error(`ValueError: invalid literal for int() with base 10: ${pyRepr(text)}`);
	}
	return Number(text.replaceAll("_", ""));
}

/**
 * Python's == between two lists
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function listsEqual(a, b) {
	return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => pyEqual(item, b[i]));
}

/**
 * Python's == between two dicts
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function dictsEqual(a, b) {
	if (!isObject(a) || !isObject(b)) {
		return false;
	}
	const keys = keysOf(a);
	return keys.length === keysOf(b).length && keys.every(key => Object.hasOwn(b, key) && pyEqual(a[key], b[key]));
}

/**
 * Python's == between scalars: True == 1, None == undefined
 * @param {unknown} value
 * @returns {unknown}
 */
function scalar(value) {
	return typeof value === "boolean" ? Number(value) : value ?? null;
}

/**
 * Python's == between JSON values
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function pyEqual(a, b) {
	if (Array.isArray(a) || Array.isArray(b)) {
		return listsEqual(a, b);
	}
	if (isObject(a) || isObject(b)) {
		return dictsEqual(a, b);
	}
	return scalar(a) === scalar(b);
}

/**
 * Elements of a, in order, that are not in b (Python's set(a) - set(b))
 * @param {Iterable<unknown>} a
 * @param {Set<unknown> | Iterable<unknown>} b
 * @returns {Set<unknown>}
 */
export function difference(a, b) {
	const excluded = b instanceof Set ? b : new Set(b);
	return new Set([...a].filter(item => !excluded.has(item)));
}

/**
 * Whether a value is in a range ({min, max}, both optional); no range accepts everything
 * @param {unknown} range
 * @param {number} value
 * @returns {boolean}
 */
export function inRange(range, value) {
	if (!truthy(range)) {
		return true;
	}
	const min = get(range, "min");
	const max = get(range, "max");
	const belowMin = min !== null && value < min;
	const aboveMax = max !== null && value > max;
	return !belowMin && !aboveMax;
}
