import { describe, it, expect } from "vitest";
import {
	ExpeditionConstants,
	getPetExpeditionPreference,
	generateTerrainBasedRisk,
	PET_PREFERENCE_REWARD_MULTIPLIERS,
	DISLIKED_SHORT_EXPEDITION_FAILURE_BONUS,
	LIKED_EXPEDITION_FAILURE_REDUCTION,
	DISLIKED_EXPEDITION_DURATION_THRESHOLD_MINUTES,
	PET_EXPEDITION_PREFERENCES
} from "../../src/constants/ExpeditionConstants";
import { PetConstants } from "../../src/constants/PetConstants";

describe("ExpeditionConstants", () => {
	describe("getPetExpeditionPreference", () => {
		describe("returns 'liked' for liked terrains", () => {
			it("should return 'liked' for dog (id 1) in forest", () => {
				expect(getPetExpeditionPreference(1, "forest")).toBe("liked");
			});

			it("should return 'liked' for dog (id 1) in plains", () => {
				expect(getPetExpeditionPreference(1, "plains")).toBe("liked");
			});

			it("should return 'liked' for dog (id 1) in mountain", () => {
				expect(getPetExpeditionPreference(1, "mountain")).toBe("liked");
			});

			it("should return 'liked' for poodle (id 2) in ruins", () => {
				expect(getPetExpeditionPreference(2, "ruins")).toBe("liked");
			});

			it("should return 'liked' for fox (id 20) in forest", () => {
				expect(getPetExpeditionPreference(20, "forest")).toBe("liked");
			});
		});

		describe("returns 'disliked' for disliked terrains", () => {
			it("should return 'disliked' for dog (id 1) in swamp", () => {
				expect(getPetExpeditionPreference(1, "swamp")).toBe("disliked");
			});

			it("should return 'disliked' for poodle (id 2) in swamp", () => {
				expect(getPetExpeditionPreference(2, "swamp")).toBe("disliked");
			});

			it("should return 'disliked' for poodle (id 2) in cave", () => {
				expect(getPetExpeditionPreference(2, "cave")).toBe("disliked");
			});

			it("should return 'disliked' for fox (id 20) in desert", () => {
				expect(getPetExpeditionPreference(20, "desert")).toBe("disliked");
			});

			it("should return 'disliked' for wolf (id 28) in desert", () => {
				expect(getPetExpeditionPreference(28, "desert")).toBe("disliked");
			});
		});

		describe("returns 'neutral' for neutral terrains", () => {
			it("should return 'neutral' for dog (id 1) in desert (not liked, not disliked)", () => {
				expect(getPetExpeditionPreference(1, "desert")).toBe("neutral");
			});

			it("should return 'neutral' for dog (id 1) in cave", () => {
				expect(getPetExpeditionPreference(1, "cave")).toBe("neutral");
			});

			it("should return 'neutral' for poodle (id 2) in forest", () => {
				expect(getPetExpeditionPreference(2, "forest")).toBe("neutral");
			});
		});

		describe("returns 'neutral' for unknown pet types", () => {
			it("should return 'neutral' for unknown pet type id", () => {
				expect(getPetExpeditionPreference(99999, "forest")).toBe("neutral");
			});

			it("should return 'neutral' for negative pet type id", () => {
				expect(getPetExpeditionPreference(-1, "plains")).toBe("neutral");
			});
		});

		describe("returns 'neutral' for pet with empty preferences (id 0)", () => {
			it("should return 'neutral' for no-pet (id 0) in any terrain", () => {
				expect(getPetExpeditionPreference(0, "forest")).toBe("neutral");
				expect(getPetExpeditionPreference(0, "cave")).toBe("neutral");
				expect(getPetExpeditionPreference(0, "plains")).toBe("neutral");
			});
		});
	});

	describe("generateTerrainBasedRisk", () => {
		describe("produces values in valid range [0, 100]", () => {
			const terrainTypes = [
				"plains",
				"coast",
				"forest",
				"desert",
				"mountain",
				"swamp",
				"ruins",
				"cave"
			] as const;

			for (const terrain of terrainTypes) {
				it(`should produce values between 0 and 100 for ${terrain}`, () => {
					// Test boundary values
					const minRisk = generateTerrainBasedRisk(terrain, 0);
					const maxRisk = generateTerrainBasedRisk(terrain, 1);
					const midRisk = generateTerrainBasedRisk(terrain, 0.5);

					expect(minRisk).toBeGreaterThanOrEqual(0);
					expect(minRisk).toBeLessThanOrEqual(100);
					expect(maxRisk).toBeGreaterThanOrEqual(0);
					expect(maxRisk).toBeLessThanOrEqual(100);
					expect(midRisk).toBeGreaterThanOrEqual(0);
					expect(midRisk).toBeLessThanOrEqual(100);
				});
			}
		});

		describe("respects terrain difficulty distribution", () => {
			it("should produce 0 risk when random is 0 for all terrains", () => {
				expect(generateTerrainBasedRisk("plains", 0)).toBe(0);
				expect(generateTerrainBasedRisk("cave", 0)).toBe(0);
				expect(generateTerrainBasedRisk("desert", 0)).toBe(0);
			});

			it("should produce 100 risk when random is 1 for all terrains", () => {
				expect(generateTerrainBasedRisk("plains", 1)).toBe(100);
				expect(generateTerrainBasedRisk("cave", 1)).toBe(100);
				expect(generateTerrainBasedRisk("desert", 1)).toBe(100);
			});

			it("cave (skew 1.8) should produce higher risk than plains (skew 0.5) for same random value", () => {
				// Higher skew factor means higher risk for same random value
				// Formula: random^(1/skewFactor)
				// Plains: 0.25^(1/0.5) = 0.25^2 = 0.0625 → low risk
				// Cave: 0.25^(1/1.8) = 0.25^0.556 ≈ 0.46 → higher risk
				const plainsRisk = generateTerrainBasedRisk("plains", 0.25);
				const caveRisk = generateTerrainBasedRisk("cave", 0.25);

				expect(caveRisk).toBeGreaterThan(plainsRisk);
			});

			it("desert (skew 1.0) should produce risk equal to random * 100", () => {
				// With skew 1.0, the power transformation is identity: random^(1/1) = random
				const risk = generateTerrainBasedRisk("desert", 0.5);
				expect(risk).toBe(50);
			});
		});

		describe("distribution bias based on skew factor", () => {
			it("dangerous terrains (high skew) should bias toward higher average risk", () => {
				// Cave has skewFactor 1.8, which means random^(1/1.8), giving higher values
				// Plains has skewFactor 0.5, which means random^2, giving lower values
				const samples = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
				const plainsAvg = samples.map(r => generateTerrainBasedRisk("plains", r)).reduce((a, b) => a + b, 0) / samples.length;
				const caveAvg = samples.map(r => generateTerrainBasedRisk("cave", r)).reduce((a, b) => a + b, 0) / samples.length;

				// Cave should have higher average risk than plains for same random samples
				expect(caveAvg).toBeGreaterThan(plainsAvg);
			});
		});
	});

	describe("PET_PREFERENCE_REWARD_MULTIPLIERS", () => {
		it("should have correct multiplier for liked preference (1x)", () => {
			expect(PET_PREFERENCE_REWARD_MULTIPLIERS.liked).toBe(1);
		});

		it("should have correct multiplier for neutral preference (0.8x)", () => {
			expect(PET_PREFERENCE_REWARD_MULTIPLIERS.neutral).toBe(0.8);
		});

		it("should have correct multiplier for disliked preference (0.25x)", () => {
			expect(PET_PREFERENCE_REWARD_MULTIPLIERS.disliked).toBe(0.25);
		});

		it("should have multipliers where liked > neutral > disliked", () => {
			expect(PET_PREFERENCE_REWARD_MULTIPLIERS.liked).toBeGreaterThan(PET_PREFERENCE_REWARD_MULTIPLIERS.neutral);
			expect(PET_PREFERENCE_REWARD_MULTIPLIERS.neutral).toBeGreaterThan(PET_PREFERENCE_REWARD_MULTIPLIERS.disliked);
		});
	});

	describe("Risk modifier constants", () => {
		describe("DISLIKED_SHORT_EXPEDITION_FAILURE_BONUS", () => {
			it("should be a positive number", () => {
				expect(DISLIKED_SHORT_EXPEDITION_FAILURE_BONUS).toBeGreaterThan(0);
			});

			it("should be 10 (extra 10% failure risk)", () => {
				expect(DISLIKED_SHORT_EXPEDITION_FAILURE_BONUS).toBe(10);
			});
		});

		describe("LIKED_EXPEDITION_FAILURE_REDUCTION", () => {
			it("should be a positive number", () => {
				expect(LIKED_EXPEDITION_FAILURE_REDUCTION).toBeGreaterThan(0);
			});

			it("should be 5 (5% failure risk reduction)", () => {
				expect(LIKED_EXPEDITION_FAILURE_REDUCTION).toBe(5);
			});
		});

		describe("DISLIKED_EXPEDITION_DURATION_THRESHOLD_MINUTES", () => {
			it("should be 720 minutes (12 hours)", () => {
				expect(DISLIKED_EXPEDITION_DURATION_THRESHOLD_MINUTES).toBe(720);
			});
		});
	});

	describe("PET_EXPEDITION_PREFERENCES structure", () => {
		it("should have preferences defined for pet id 0 (no pet)", () => {
			expect(PET_EXPEDITION_PREFERENCES[0]).toBeDefined();
			expect(PET_EXPEDITION_PREFERENCES[0].liked).toEqual([]);
			expect(PET_EXPEDITION_PREFERENCES[0].disliked).toEqual([]);
		});

		it("should have preferences defined for all pets (except NO_PET)", () => {
			const allPetIds = Object.values(PetConstants.PETS).filter(id => id !== PetConstants.PETS.NO_PET);
			const petsWithoutPreferences: number[] = [];

			for (const petId of allPetIds) {
				if (!PET_EXPEDITION_PREFERENCES[petId]) {
					petsWithoutPreferences.push(petId);
				}
			}

			if (petsWithoutPreferences.length > 0) {
				const petNames = Object.entries(PetConstants.PETS)
					.filter(([, id]) => petsWithoutPreferences.includes(id))
					.map(([name, id]) => `${name} (${id})`);
				expect.fail(`The following pets don't have expedition preferences defined:\n  ${petNames.join("\n  ")}`);
			}

			expect(petsWithoutPreferences).toHaveLength(0);
		});

		it("each pet should have 0 to 4 liked expedition locations", () => {
			const petsWithInvalidLiked: { id: number; name: string; count: number }[] = [];

			for (const [petIdStr, prefs] of Object.entries(PET_EXPEDITION_PREFERENCES)) {
				const petId = Number(petIdStr);
				const likedCount = prefs.liked.length;

				if (likedCount < 0 || likedCount > 4) {
					const petName = Object.entries(PetConstants.PETS).find(([, id]) => id === petId)?.[0] ?? "UNKNOWN";
					petsWithInvalidLiked.push({ id: petId, name: petName, count: likedCount });
				}
			}

			if (petsWithInvalidLiked.length > 0) {
				const errorMsg = petsWithInvalidLiked
					.map(p => `  ${p.name} (${p.id}): ${p.count} liked locations (expected 0-4)`)
					.join("\n");
				expect.fail(`The following pets have invalid liked count:\n${errorMsg}`);
			}

			expect(petsWithInvalidLiked).toHaveLength(0);
		});

		it("each pet should have 0 to 2 disliked expedition locations", () => {
			const petsWithInvalidDisliked: { id: number; name: string; count: number }[] = [];

			for (const [petIdStr, prefs] of Object.entries(PET_EXPEDITION_PREFERENCES)) {
				const petId = Number(petIdStr);
				const dislikedCount = prefs.disliked.length;

				if (dislikedCount < 0 || dislikedCount > 2) {
					const petName = Object.entries(PetConstants.PETS).find(([, id]) => id === petId)?.[0] ?? "UNKNOWN";
					petsWithInvalidDisliked.push({ id: petId, name: petName, count: dislikedCount });
				}
			}

			if (petsWithInvalidDisliked.length > 0) {
				const errorMsg = petsWithInvalidDisliked
					.map(p => `  ${p.name} (${p.id}): ${p.count} disliked locations (expected 0-2)`)
					.join("\n");
				expect.fail(`The following pets have invalid disliked count:\n${errorMsg}`);
			}

			expect(petsWithInvalidDisliked).toHaveLength(0);
		});

		it("each pet (except NO_PET) should have at least one preference (not 0 liked AND 0 disliked)", () => {
			const petsWithNoPreferences: { id: number; name: string }[] = [];

			for (const [petIdStr, prefs] of Object.entries(PET_EXPEDITION_PREFERENCES)) {
				const petId = Number(petIdStr);

				// Skip NO_PET (id 0) which is allowed to have empty preferences
				if (petId === PetConstants.PETS.NO_PET) {
					continue;
				}

				// Check if both liked and disliked are empty
				if (prefs.liked.length === 0 && prefs.disliked.length === 0) {
					const petName = Object.entries(PetConstants.PETS).find(([, id]) => id === petId)?.[0] ?? "UNKNOWN";
					petsWithNoPreferences.push({ id: petId, name: petName });
				}
			}

			if (petsWithNoPreferences.length > 0) {
				const errorMsg = petsWithNoPreferences
					.map(p => `  ${p.name} (${p.id})`)
					.join("\n");
				expect.fail(`The following pets have no preferences (0 liked AND 0 disliked):\n${errorMsg}`);
			}

			expect(petsWithNoPreferences).toHaveLength(0);
		});

		it("each pet should have arrays for liked and disliked", () => {
			for (const [petId, prefs] of Object.entries(PET_EXPEDITION_PREFERENCES)) {
				expect(Array.isArray(prefs.liked)).toBe(true);
				expect(Array.isArray(prefs.disliked)).toBe(true);
			}
		});

		it("should not have overlapping liked and disliked terrains for any pet", () => {
			for (const [petId, prefs] of Object.entries(PET_EXPEDITION_PREFERENCES)) {
				const overlap = prefs.liked.filter(terrain => prefs.disliked.includes(terrain));
				expect(overlap).toEqual([]);
			}
		});

		it("should only contain valid expedition location types", () => {
			const validTypes = Object.values(ExpeditionConstants.EXPEDITION_LOCATION_TYPES);

			for (const [petId, prefs] of Object.entries(PET_EXPEDITION_PREFERENCES)) {
				for (const terrain of prefs.liked) {
					expect(validTypes).toContain(terrain);
				}
				for (const terrain of prefs.disliked) {
					expect(validTypes).toContain(terrain);
				}
			}
		});
	});

	describe("TERRAIN_DIFFICULTY configuration", () => {
		it("should have configuration for all expedition location types", () => {
			const locationTypes = Object.values(ExpeditionConstants.EXPEDITION_LOCATION_TYPES);

			for (const locationType of locationTypes) {
				expect(ExpeditionConstants.TERRAIN_DIFFICULTY[locationType]).toBeDefined();
				expect(ExpeditionConstants.TERRAIN_DIFFICULTY[locationType].skewFactor).toBeGreaterThan(0);
			}
		});

		it("should have increasing difficulty for dangerous terrains", () => {
			// Plains should be easiest (lowest skew = highest risk from low random)
			// Cave should be hardest (highest skew = needs high random for high risk)
			expect(ExpeditionConstants.TERRAIN_DIFFICULTY.plains.skewFactor)
				.toBeLessThan(ExpeditionConstants.TERRAIN_DIFFICULTY.cave.skewFactor);
		});

		it("should have reasonable skew factors (between 0 and 3)", () => {
			for (const [terrain, config] of Object.entries(ExpeditionConstants.TERRAIN_DIFFICULTY)) {
				expect(config.skewFactor).toBeGreaterThan(0);
				expect(config.skewFactor).toBeLessThanOrEqual(3);
			}
		});
	});
});
