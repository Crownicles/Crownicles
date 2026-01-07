import { describe, expect, it } from "vitest";
import { safeStringify } from "../../src/logs/CrowniclesLogger";

describe("safeStringify", () => {
	it("should stringify simple objects", () => {
		const obj = { name: "test", value: 123 };
		expect(safeStringify(obj)).toBe('{"name":"test","value":123}');
	});

	it("should stringify nested objects", () => {
		const obj = { level1: { level2: { level3: "deep" } } };
		expect(safeStringify(obj)).toBe('{"level1":{"level2":{"level3":"deep"}}}');
	});

	it("should stringify arrays", () => {
		const arr = [1, 2, { nested: true }];
		expect(safeStringify(arr)).toBe('[1,2,{"nested":true}]');
	});

	it("should handle null values", () => {
		expect(safeStringify(null)).toBe("null");
	});

	it("should handle undefined", () => {
		// undefined is not valid JSON, JSON.stringify returns undefined
		expect(safeStringify(undefined)).toBeUndefined();
	});

	it("should handle primitive values", () => {
		expect(safeStringify("string")).toBe('"string"');
		expect(safeStringify(123)).toBe("123");
		expect(safeStringify(true)).toBe("true");
	});

	it("should handle circular references in objects", () => {
		const obj: Record<string, unknown> = { name: "circular" };
		obj.self = obj;

		const result = safeStringify(obj);
		expect(result).toBe('{"name":"circular","self":"[Circular]"}');
	});

	it("should handle circular references in nested objects", () => {
		const parent: Record<string, unknown> = { name: "parent" };
		const child: Record<string, unknown> = { name: "child", parent };
		parent.child = child;

		const result = safeStringify(parent);
		expect(result).toContain('"name":"parent"');
		expect(result).toContain('"name":"child"');
		expect(result).toContain('"[Circular]"');
	});

	it("should handle circular references in arrays", () => {
		const arr: unknown[] = [1, 2, 3];
		arr.push(arr);

		const result = safeStringify(arr);
		expect(result).toBe('[1,2,3,"[Circular]"]');
	});

	it("should handle deeply nested circular references", () => {
		const a: Record<string, unknown> = { name: "a" };
		const b: Record<string, unknown> = { name: "b", parent: a };
		const c: Record<string, unknown> = { name: "c", parent: b };
		a.deep = c;
		c.loop = a;

		const result = safeStringify(a);
		expect(result).toContain('"[Circular]"');
	});

	it("should handle empty objects", () => {
		expect(safeStringify({})).toBe("{}");
	});

	it("should handle empty arrays", () => {
		expect(safeStringify([])).toBe("[]");
	});

	it("should handle objects with null values", () => {
		const obj = { name: "test", nullValue: null };
		expect(safeStringify(obj)).toBe('{"name":"test","nullValue":null}');
	});

	it("should handle multiple references to the same object (not circular)", () => {
		const shared = { value: "shared" };
		const obj = { a: shared, b: shared };

		// Note: WeakSet will mark the second reference as circular
		// This is a known limitation
		const result = safeStringify(obj);
		expect(result).toContain('"a":{"value":"shared"}');
		expect(result).toContain('"b":"[Circular]"');
	});
});
