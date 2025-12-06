import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const MISSIONS_PATH = join(__dirname, "../../../resources/missions");

interface MissionData {
	campaignOnly: boolean;
	difficulties?: {
		easy?: number[];
		medium?: number[];
		hard?: number[];
	};
	objectives?: number[];
	gems?: number[];
	xp?: number[];
	points?: number[];
	money?: number[];
	expirations?: number[];
	dailyIndexes?: number[];
}

describe("Mission JSON files validation", () => {
	const missionFiles = readdirSync(MISSIONS_PATH).filter(file => file.endsWith(".json"));

	it("should have mission files to test", () => {
		expect(missionFiles.length).toBeGreaterThan(0);
	});

	describe.each(missionFiles)("Mission file: %s", (filename) => {
		const filePath = join(MISSIONS_PATH, filename);
		const missionData: MissionData = JSON.parse(readFileSync(filePath, "utf-8"));

		it("should have valid structure", () => {
			expect(missionData).toHaveProperty("campaignOnly");
			expect(typeof missionData.campaignOnly).toBe("boolean");
		});

		it("should have consistent array lengths for reward fields", () => {
			const objectives = missionData.objectives;

			// Skip campaign-only missions without objectives array
			if (!objectives || objectives.length === 0) {
				return;
			}

			const expectedLength = objectives.length;
			const rewardFields = ["gems", "xp", "points", "money", "expirations"] as const;

			for (const field of rewardFields) {
				const fieldArray = missionData[field];
				if (fieldArray !== undefined) {
					expect(
						fieldArray.length,
						`Field "${field}" has ${fieldArray.length} elements but objectives has ${expectedLength} elements`
					).toBe(expectedLength);
				}
			}
		});

		it("should have difficulty indexes within objectives bounds", () => {
			const objectives = missionData.objectives;
			const difficulties = missionData.difficulties;

			if (!objectives || !difficulties) {
				return;
			}

			const maxIndex = objectives.length - 1;

			for (const [difficultyName, indexes] of Object.entries(difficulties)) {
				if (indexes) {
					for (const index of indexes) {
						expect(
							index,
							`Difficulty "${difficultyName}" has index ${index} but max valid index is ${maxIndex}`
						).toBeLessThanOrEqual(maxIndex);
						expect(
							index,
							`Difficulty "${difficultyName}" has negative index ${index}`
						).toBeGreaterThanOrEqual(0);
					}
				}
			}
		});

		it("should have dailyIndexes within objectives bounds", () => {
			const objectives = missionData.objectives;
			const dailyIndexes = missionData.dailyIndexes;

			if (!objectives || !dailyIndexes) {
				return;
			}

			const maxIndex = objectives.length - 1;

			for (const index of dailyIndexes) {
				expect(
					index,
					`dailyIndexes contains ${index} but max valid index is ${maxIndex}`
				).toBeLessThanOrEqual(maxIndex);
				expect(
					index,
					`dailyIndexes contains negative index ${index}`
				).toBeGreaterThanOrEqual(0);
			}
		});

		it("should have non-negative values in reward arrays", () => {
			const numericFields = ["objectives", "gems", "xp", "points", "money", "expirations"] as const;

			for (const field of numericFields) {
				const fieldArray = missionData[field];
				if (fieldArray) {
					for (let i = 0; i < fieldArray.length; i++) {
						expect(
							fieldArray[i],
							`Field "${field}[${i}]" has negative value ${fieldArray[i]}`
						).toBeGreaterThanOrEqual(0);
					}
				}
			}
		});

		it("should have all variants referenced in difficulties", () => {
			const objectives = missionData.objectives;
			const difficulties = missionData.difficulties;

			// Skip campaign-only missions or missions without objectives/difficulties
			if (!objectives || !difficulties || objectives.length === 0) {
				return;
			}

			// Collect all variant indexes referenced in difficulties
			const referencedVariants = new Set<number>();
			for (const indexes of Object.values(difficulties)) {
				if (indexes) {
					for (const index of indexes) {
						referencedVariants.add(index);
					}
				}
			}

			// Check that all variants (0 to objectives.length - 1) are referenced
			const totalVariants = objectives.length;
			const unreferencedVariants: number[] = [];

			for (let i = 0; i < totalVariants; i++) {
				if (!referencedVariants.has(i)) {
					unreferencedVariants.push(i);
				}
			}

			expect(
				unreferencedVariants,
				`Mission has ${unreferencedVariants.length} unreferenced variant(s): [${unreferencedVariants.join(", ")}]. ` +
				`All variants (0-${totalVariants - 1}) must be referenced in difficulties (easy/medium/hard).`
			).toHaveLength(0);
		});
	});
});
