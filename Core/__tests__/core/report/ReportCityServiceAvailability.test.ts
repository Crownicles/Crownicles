import {
	describe, expect, it
} from "vitest";
import { CITY_SERVICES } from "../../../../Lib/src/constants/CityServiceConstants";
import { getAvailableCityServices } from "../../../src/core/report/ReportCityServiceAvailability";

describe("getAvailableCityServices", () => {
	it("returns available services in their shared definition order", () => {
		expect(getAvailableCityServices({
			[CITY_SERVICES.BLACKSMITH]: true,
			[CITY_SERVICES.ROYAL_BLACKSMITH]: false,
			[CITY_SERVICES.ENCHANTER]: true,
			[CITY_SERVICES.BOSS_ARCHIVIST]: false
		})).toEqual([
			CITY_SERVICES.BLACKSMITH,
			CITY_SERVICES.ENCHANTER
		]);
	});
});
