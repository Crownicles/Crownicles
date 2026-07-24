import {
	describe, expect, it
} from "vitest";
import * as fs from "fs";
import * as path from "path";

const PLAYER_MODEL_PATH = path.join(__dirname, "../../../src/core/database/game/models/Player.ts");

function countOccurrences(source: string, value: string): number {
	return source.split(value).length - 1;
}

describe("Player mutation contract", () => {
	it("centralizes mission reloads and caller synchronization", () => {
		const source = fs.readFileSync(PLAYER_MODEL_PATH, "utf8");
		const contractStart = source.indexOf("private async mutateWithMission(");
		const contractEnd = source.indexOf("\n\t/**\n\t * Add or remove points", contractStart);
		const contract = source.slice(contractStart, contractEnd);

		expect(contractStart).toBeGreaterThan(-1);
		expect(contractEnd).toBeGreaterThan(contractStart);
		expect(countOccurrences(source, "MissionsController.update(this")).toBe(1);
		expect(countOccurrences(source, "MissionsController.updateMultiple(this")).toBe(1);
		expect(countOccurrences(source, "Player.withLocked(this.id")).toBe(1);
		expect(countOccurrences(source, "Object.assign(this")).toBe(3);
		expect(contract).toContain("MissionsController.update(this");
		expect(contract).toContain("MissionsController.updateMultiple(this");
		expect(contract).toContain("Player.withLocked(this.id");
		expect(countOccurrences(contract, "Object.assign(this")).toBe(3);
	});
});