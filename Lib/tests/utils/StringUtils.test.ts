import { describe, it, expect } from 'vitest';
import {
	checkNameString, discordIdToMention, escapeUsername, getChannelMention, getMention, isAnEmoji, isAnId, progressBar,
	toSignedPercent
} from "../../src/utils/StringUtils";

describe('progressBar', () => {
	it('should create a 50% progress bar correctly', () => {
		const result = progressBar(50, 100);
		expect(result).toBe("```[▇▇▇▇▇▇▇▇▇▇——————————]50%```");
	});

	it('should create a 100% progress bar correctly', () => {
		const result = progressBar(100, 100);
		expect(result).toBe("```[▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇]100%```");
	});

	it('should create a 0% progress bar correctly', () => {
		const result = progressBar(0, 100);
		expect(result).toBe("```[————————————————————]0%```");
	});

	it('should handle negative values by setting progress to 0%', () => {
		const result = progressBar(-50, 100);
		expect(result).toBe("```[————————————————————]0%```");
	});

	it('should handle NaN values by setting progress to 0%', () => {
		const result = progressBar(NaN, 100);
		expect(result).toBe("```[————————————————————]0%```");
	});

	it('should handle Infinity values by setting progress to 0%', () => {
		const result = progressBar(Infinity, 100);
		expect(result).toBe("```[————————————————————]0%```");
	});

	it('should cap progress at 100% when value exceeds maxValue', () => {
		const result = progressBar(150, 100);
		expect(result).toBe("```[▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇]100%```");
	});

	it('should handle decimal values correctly', () => {
		const result = progressBar(33.33, 100);
		expect(result).toBe("```[▇▇▇▇▇▇▇—————————————]33%```");
	});
});

describe("escapeUsername", () => {
	it("removes the discord formatting characters", () => {
		expect(escapeUsername("*b_o|l`d*")).toBe("bold");
	});

	it("replaces a name made only of formatting characters by a dot", () => {
		expect(escapeUsername("**__")).toBe(".");
	});
});

describe("checkNameString", () => {
	const range = {
		MIN: 3, MAX: 10
	};

	it.each([
		"Abc",
		"Les Élus 2",
		"Hé, toi!",
		"l'équipe",
		"a-b.c:d(e)",
		"Zz9",
		"café",
		"0123456789".slice(0, 9) + "a"
	])("accepts %j", name => {
		expect(checkNameString(name, range)).toBe(true);
	});

	it.each([
		["too short", "ab"],
		["too long", "abcdefghijk"],
		["only digits and spaces", "12 34"],
		["two spaces in a row at the end", "abc  "],
		["three accented letters in a row at the end", "abcééé"],
		["two punctuation marks in a row", "ab!!cd"],
		["a dash next to a punctuation mark", "ab-.cd"],
		["a forbidden character", "abc_def"],
		["an emoji", "abc😀"],
		["an empty name", ""]
	])("refuses a name with %s", (_case, name) => {
		expect(checkNameString(name, range)).toBe(false);
	});

	it("accepts names of exactly the minimal and maximal lengths", () => {
		expect(checkNameString("abc", range)).toBe(true);
		expect(checkNameString("abcdefghij", range)).toBe(true);
	});

	it("checks the whole name and not only its start or end", () => {
		expect(checkNameString("_abc", range)).toBe(false);
		expect(checkNameString("abc_", range)).toBe(false);
		expect(checkNameString("12 34a", range)).toBe(true);
		expect(checkNameString("a12 34", range)).toBe(true);
	});

	it("refuses two spaces in a row anywhere in a name", () => {
		expect(checkNameString("a  bcd", range)).toBe(false);
		expect(checkNameString("  abcd", range)).toBe(false);
	});

	it("refuses three accented letters in a row anywhere in a name", () => {
		expect(checkNameString("aéééb", range)).toBe(false);
		expect(checkNameString("éàêbcd", range)).toBe(false);
	});

	it.each([
		"créée",
		"réélu",
		"préétabli"
	])("accepts the French word %j, which has two accented letters in a row", name => {
		expect(checkNameString(name, range)).toBe(true);
	});

	it.each([
		"Médor",
		"Noël",
		"Rex le Fou",
		"L'Élu",
		"Zoé et Léa",
		"Brûlé-Joë",
		"Ça va",
		"Été 2024"
	])("still accepts the typical name %j", name => {
		expect(checkNameString(name, range)).toBe(true);
	});
});

describe("discord mentions", () => {
	it("formats user and channel mentions", () => {
		expect(discordIdToMention("123")).toBe("<@123>");
		expect(getMention("456")).toBe("<@456>");
		expect(getChannelMention("789")).toBe("<#789>");
	});
});

describe("isAnId", () => {
	it("recognises a keycloak id", () => {
		expect(isAnId("0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d")).toBe(true);
	});

	it.each([
		"0A1B2C3D-4E5F-6A7B-8C9D-0E1F2A3B4C5D",
		"0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5",
		"x0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
		"0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5dx",
		"0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d",
		"0a1b2c3-d4e5f-6a7b-8c9d-0e1f2a3b4c5d",
		"0a1b2c3d-4e5-f6a7b-8c9d-0e1f2a3b4c5d",
		"0a1b2c3d-4e5f-6a7-b8c9d-0e1f2a3b4c5d",
		"0a1b2c3d-4e5f-6a7b-8c9-d0e1f2a3b4c5d",
		"0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5g",
		"123456789012345678"
	])("refuses %j", value => {
		expect(isAnId(value)).toBe(false);
	});
});

describe("isAnEmoji", () => {
	it("detects an emoji anywhere in the string", () => {
		expect(isAnEmoji("🍎")).toBe(true);
		expect(isAnEmoji("an apple 🍎")).toBe(true);
		expect(isAnEmoji("an apple")).toBe(false);
	});
});

describe("toSignedPercent", () => {
	it("converts a ratio into a rounded signed percentage", () => {
		expect(toSignedPercent(0.8)).toBe(-20);
		expect(toSignedPercent(1.2)).toBe(20);
		expect(toSignedPercent(1)).toBeCloseTo(0);
		expect(toSignedPercent(1.126)).toBe(13);
	});
});
