import {
	beforeAll, describe, expect, it
} from "vitest";
import * as fs from "fs";
import * as path from "path";
import { HealthEditValueParameters } from "../../../src/core/database/game/EditValueParameters";

/**
 * These tests verify architectural consistency across the codebase.
 * They ensure that all value-editing functions follow the EditValueParameters pattern
 * instead of using positional parameters (which are harder to maintain and error-prone).
 */
describe("EditValueParameters consistency", () => {
	const coreModelsPath = path.join(__dirname, "../../../src/core/database/game/models");

	describe("Player model", () => {
		const playerFilePath = path.join(coreModelsPath, "Player.ts");
		let playerCode: string;

		beforeAll(() => {
			playerCode = fs.readFileSync(playerFilePath, "utf-8");
		});

		it("addScore should use EditValueParameters", () => {
			expect(playerCode).toMatch(/addScore\(parameters:\s*EditValueParameters\)/);
		});

		it("addMoney should use EditValueParameters", () => {
			expect(playerCode).toMatch(/addMoney\(parameters:\s*EditValueParameters\)/);
		});

		it("spendMoney should use EditValueParameters", () => {
			expect(playerCode).toMatch(/spendMoney\(parameters:\s*EditValueParameters\)/);
		});

		it("addTokens should use EditValueParameters", () => {
			expect(playerCode).toMatch(/addTokens\(parameters:\s*EditValueParameters\)/);
		});

		it("addExperience should use EditValueParameters", () => {
			expect(playerCode).toMatch(/addExperience\(parameters:\s*EditValueParameters\)/);
		});

		it("addHealth should use HealthEditValueParameters", () => {
			expect(playerCode).toMatch(/addHealth\(parameters:\s*HealthEditValueParameters\)/);
		});

		it("addRage should use EditValueParameters", () => {
			expect(playerCode).toMatch(/addRage\(parameters:\s*EditValueParameters\)/);
		});
	});

	describe("Guild model", () => {
		const guildFilePath = path.join(coreModelsPath, "Guild.ts");
		let guildCode: string;

		beforeAll(() => {
			guildCode = fs.readFileSync(guildFilePath, "utf-8");
		});

		it("addExperience should use EditValueParameters", () => {
			expect(guildCode).toMatch(/addExperience\(parameters:\s*EditValueParameters\)/);
		});

		it("addScore should use EditValueParameters", () => {
			expect(guildCode).toMatch(/addScore\(parameters:\s*EditValueParameters\)/);
		});
	});

	describe("Type definitions", () => {
		const editValueParametersFilePath = path.join(__dirname, "../../../src/core/database/game/EditValueParameters.ts");
		let editValueParametersCode: string;

		beforeAll(() => {
			editValueParametersCode = fs.readFileSync(editValueParametersFilePath, "utf-8");
		});

		it("should export EditValueParameters type", () => {
			expect(editValueParametersCode).toMatch(/export type EditValueParameters\s*=/);
		});

		it("should export HealthEditValueParameters type", () => {
			expect(editValueParametersCode).toMatch(/export type HealthEditValueParameters\s*=/);
		});

		it("HealthEditValueParameters should extend EditValueParameters", () => {
			expect(editValueParametersCode).toMatch(/HealthEditValueParameters\s*=\s*EditValueParameters\s*&/);
		});
	});

	describe("HealthEditValueParameters type contract", () => {
		it("should allow creating valid HealthEditValueParameters", () => {
			const params: HealthEditValueParameters = {
				amount: 10,
				response: [],
				reason: 0
			};
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
		});

		it("should allow negative, positive, and zero amounts", () => {
			const negative: HealthEditValueParameters = { amount: -30, response: [], reason: 0 };
			const positive: HealthEditValueParameters = { amount: 50, response: [], reason: 0 };
			const zero: HealthEditValueParameters = { amount: 0, response: [], reason: 0 };

			expect(negative.amount).toBeLessThan(0);
			expect(positive.amount).toBeGreaterThan(0);
			expect(zero.amount).toBe(0);
		});
	});
});
