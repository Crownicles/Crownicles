import {
	describe, expect, it
} from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ADVICES_PATH = join(__dirname, "..", "..", "..", "Lang", "fr", "advices.json");

// Advices are also posted raw by the daily advice webhook, which only rewrites `{command:...}`.
const UNSUPPORTED_PLACEHOLDER = /\{emote:|\$t\(|\{\{/u;

describe("advices translations", () => {
	it("contain no placeholder that only the bot can render", () => {
		const { advices } = JSON.parse(readFileSync(ADVICES_PATH, "utf-8")) as { advices: string[] };
		const offending = advices.filter(advice => UNSUPPORTED_PLACEHOLDER.test(advice));

		expect(offending).toEqual([]);
	});
});
