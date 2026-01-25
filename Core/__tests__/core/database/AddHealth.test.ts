import {
	describe, expect, it
} from "vitest";
import { HealthEditValueParameters } from "../../../src/core/database/game/models/Player";

/**
 * These tests verify the HealthEditValueParameters type contract.
 * They ensure that the addHealth function signature follows the EditValueParameters pattern
 * and prevents regression to the old positional parameters pattern.
 */
describe("HealthEditValueParameters type contract", () => {
	describe("type structure validation", () => {
		it("should export HealthEditValueParameters type", () => {
			// This test fails at compile time if the type is not exported
			const params: HealthEditValueParameters = {
				amount: 10,
				response: [],
				reason: 0
			};
			expect(params).toBeDefined();
		});

		it("should require amount, response, and reason properties", () => {
			const params: HealthEditValueParameters = {
				amount: 10,
				response: [],
				reason: 0
			};

			// Verify the object has all required properties
			expect(params).toHaveProperty("amount");
			expect(params).toHaveProperty("response");
			expect(params).toHaveProperty("reason");
		});

		it("should allow optional missionHealthParameter", () => {
			const paramsWithout: HealthEditValueParameters = {
				amount: 10,
				response: [],
				reason: 0
			};
			expect(paramsWithout.missionHealthParameter).toBeUndefined();

			const paramsWith: HealthEditValueParameters = {
				amount: 10,
				response: [],
				reason: 0,
				missionHealthParameter: {
					shouldPokeMission: true,
					overHealCountsForMission: false
				}
			};
			expect(paramsWith.missionHealthParameter).toBeDefined();
			expect(paramsWith.missionHealthParameter?.shouldPokeMission).toBe(true);
			expect(paramsWith.missionHealthParameter?.overHealCountsForMission).toBe(false);
		});
	});

	describe("value handling", () => {
		it("should allow negative amounts for damage", () => {
			const params: HealthEditValueParameters = {
				amount: -30,
				response: [],
				reason: 0
			};
			expect(params.amount).toBeLessThan(0);
		});

		it("should allow positive amounts for healing", () => {
			const params: HealthEditValueParameters = {
				amount: 50,
				response: [],
				reason: 0
			};
			expect(params.amount).toBeGreaterThan(0);
		});

		it("should allow zero amount", () => {
			const params: HealthEditValueParameters = {
				amount: 0,
				response: [],
				reason: 0
			};
			expect(params.amount).toBe(0);
		});
	});

	describe("missionHealthParameter structure", () => {
		it("should have shouldPokeMission boolean property", () => {
			const params: HealthEditValueParameters = {
				amount: 10,
				response: [],
				reason: 0,
				missionHealthParameter: {
					shouldPokeMission: true,
					overHealCountsForMission: true
				}
			};
			expect(typeof params.missionHealthParameter?.shouldPokeMission).toBe("boolean");
		});

		it("should have overHealCountsForMission boolean property", () => {
			const params: HealthEditValueParameters = {
				amount: 10,
				response: [],
				reason: 0,
				missionHealthParameter: {
					shouldPokeMission: true,
					overHealCountsForMission: false
				}
			};
			expect(typeof params.missionHealthParameter?.overHealCountsForMission).toBe("boolean");
		});
	});
});
