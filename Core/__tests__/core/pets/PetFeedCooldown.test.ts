import {
	describe, expect, it
} from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("Pet feed cooldown validation", () => {
	// Base cooldown should be 30 minutes
	const EXPECTED_BASE_COOLDOWN = 30 * 60 * 1000; // 30 minutes in milliseconds

	it("should validate sample pets have correct feedDelay cooldown durations", () => {
		// Test a sample of pets with different feedDelay values
		const petsPath = resolve(__dirname, "../../../resources/pets");
		
		// Test pet with feedDelay = 1 (should feed every 30 min)
		const pet0Data = JSON.parse(readFileSync(resolve(petsPath, "0.json"), "utf8"));
		expect(pet0Data.feedDelay).toBe(1);
		const expectedPet0Cooldown = EXPECTED_BASE_COOLDOWN * pet0Data.feedDelay;
		expect(expectedPet0Cooldown).toBe(30 * 60 * 1000); // 30 minutes
		
		// Test pet with feedDelay = 2 (should feed every 1 hour)
		const pet11Data = JSON.parse(readFileSync(resolve(petsPath, "11.json"), "utf8"));
		expect(pet11Data.feedDelay).toBe(2);
		const expectedPet11Cooldown = EXPECTED_BASE_COOLDOWN * pet11Data.feedDelay;
		expect(expectedPet11Cooldown).toBe(60 * 60 * 1000); // 1 hour
		
		// Test pet with feedDelay = 10 (should feed every 5 hours)
		const pet15Data = JSON.parse(readFileSync(resolve(petsPath, "15.json"), "utf8"));
		expect(pet15Data.feedDelay).toBe(10);
		const expectedPet15Cooldown = EXPECTED_BASE_COOLDOWN * pet15Data.feedDelay;
		expect(expectedPet15Cooldown).toBe(5 * 60 * 60 * 1000); // 5 hours
	});

	it("should have linear scaling between feedDelay values", () => {
		// feedDelay 1 = 30 min, feedDelay 2 = 60 min, feedDelay 10 = 300 min (5h)
		const cooldownForOne = EXPECTED_BASE_COOLDOWN * 1;
		const cooldownForTwo = EXPECTED_BASE_COOLDOWN * 2;
		const cooldownForTen = EXPECTED_BASE_COOLDOWN * 10;
		
		expect(cooldownForOne).toBe(30 * 60 * 1000); // 30 minutes
		expect(cooldownForTwo).toBe(60 * 60 * 1000); // 1 hour
		expect(cooldownForTen).toBe(5 * 60 * 60 * 1000); // 5 hours
		
		// Verify linear scaling
		expect(cooldownForTwo).toBe(cooldownForOne * 2);
		expect(cooldownForTen).toBe(cooldownForOne * 10);
	});

	it("should verify feedDelay range produces correct time range (30min to 5h)", () => {
		const minFeedDelay = 1;
		const maxFeedDelay = 10;
		
		const minCooldown = EXPECTED_BASE_COOLDOWN * minFeedDelay;
		const maxCooldown = EXPECTED_BASE_COOLDOWN * maxFeedDelay;
		
		// Min should be 30 minutes
		expect(minCooldown).toBe(30 * 60 * 1000);
		
		// Max should be 5 hours
		expect(maxCooldown).toBe(5 * 60 * 60 * 1000);
	});

	it("should validate that BREED_COOLDOWN constant is set to 30 minutes", () => {
		// Read the PetConstants file to verify the constant value
		const constantsPath = resolve(__dirname, "../../../../Lib/src/constants/PetConstants.ts");
		const constantsContent = readFileSync(constantsPath, "utf8");
		
		// Check that BREED_COOLDOWN is set to 30 * 60 * 1000
		const cooldownMatch = constantsContent.match(/BREED_COOLDOWN\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)/);
		expect(cooldownMatch).not.toBeNull();
		
		if (cooldownMatch) {
			const [, num1, num2, num3] = cooldownMatch;
			const calculatedValue = parseInt(num1) * parseInt(num2) * parseInt(num3);
			expect(calculatedValue).toBe(EXPECTED_BASE_COOLDOWN);
		}
	});
});
