import {
	describe, expect, it
} from "vitest";
import {
	readdirSync, readFileSync
} from "fs";
import { resolve } from "path";
import { CITY_SERVICES } from "../../../../Lib/src/constants/CityServiceConstants";

const citiesPath = resolve(__dirname, "../../../resources/cities");

function readCities(): [string, { services?: unknown }][] {
	return readdirSync(citiesPath)
		.filter(file => file.endsWith(".json"))
		.map(file => [
			file,
			JSON.parse(readFileSync(resolve(citiesPath, file), "utf-8")) as { services?: unknown }
		]);
}

describe("City data integrity", () => {
	it.each(readCities())("%s declares a valid service list", (_file, city) => {
		expect(Array.isArray(city.services)).toBe(true);
		for (const service of city.services as string[]) {
			expect(Object.values(CITY_SERVICES)).toContain(service);
		}
	});

	it("does not host the enchanter statically, since its city rotates", () => {
		for (const [, city] of readCities()) {
			expect(city.services).not.toContain(CITY_SERVICES.ENCHANTER);
		}
	});
});
