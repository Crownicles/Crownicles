import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	describe,
	expect,
	it
} from "vitest";

type CommandsTranslations = {
	report: {
		city: {
			homes: {
				garden: {
					waterSuccess_zero: string;
				};
			};
		};
	};
};

describe("Garden watering translations", () => {
	it("describes the configured five-percent growth effect in French", () => {
		const commands = JSON.parse(readFileSync(
			resolve(__dirname, "../../../Lang/fr/commands.json"),
			"utf8"
		)) as CommandsTranslations;
		const message = commands.report.city.homes.garden.waterSuccess_zero;

		expect(message).toContain("5 %");
		expect(message).not.toMatch(/heure/i);
	});
});
