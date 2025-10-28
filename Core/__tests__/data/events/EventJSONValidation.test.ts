import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

describe("Event JSON Validation", () => {
	const eventsDir = join(__dirname, "../../../resources/events");
	const eventFiles = readdirSync(eventsDir).filter(file => file.endsWith(".json"));

	// Liste des propriétés valides dans requirements
	const validRequirements = [
		"level",
		"karma", 
		"health",
		"defense",
		"attack",
		"speed",
		"campaignCurrentMissionId",
		"validPetTypeIds",
		"petRarity",
		"validClassIds"
	];

	eventFiles.forEach(filename => {
		describe(`Event file: ${filename}`, () => {
			let eventData: any;

			it("should have valid JSON structure", () => {
				const filePath = join(eventsDir, filename);
				const content = readFileSync(filePath, "utf8");
				
				expect(() => {
					eventData = JSON.parse(content);
				}).not.toThrow();
			});

			it("should not contain deprecated petTypeId in requirements", () => {
				if (!eventData?.possibilities) return;

				const deprecatedFields: string[] = [];
				
				Object.entries(eventData.possibilities).forEach(([possibilityKey, possibility]: [string, any]) => {
					if (!possibility.outcomes) return;
					
					Object.entries(possibility.outcomes).forEach(([outcomeKey, outcome]: [string, any]) => {
						if (!outcome.requirements) return;
						
						if (outcome.requirements.petTypeId !== undefined) {
							deprecatedFields.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.petTypeId`);
						}
					});
				});

				expect(deprecatedFields).toEqual([]);
			});

			it("should have validPetTypeIds as array when present", () => {
				if (!eventData?.possibilities) return;

				const invalidFields: string[] = [];
				
				Object.entries(eventData.possibilities).forEach(([possibilityKey, possibility]: [string, any]) => {
					if (!possibility.outcomes) return;
					
					Object.entries(possibility.outcomes).forEach(([outcomeKey, outcome]: [string, any]) => {
						if (!outcome.requirements?.validPetTypeIds) return;
						
						if (!Array.isArray(outcome.requirements.validPetTypeIds)) {
							invalidFields.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.validPetTypeIds should be array, got ${typeof outcome.requirements.validPetTypeIds}`);
						} else {
							// Vérifier que tous les éléments sont des nombres
							outcome.requirements.validPetTypeIds.forEach((id: any, index: number) => {
								if (typeof id !== "number") {
									invalidFields.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.validPetTypeIds[${index}] should be number, got ${typeof id}`);
								}
							});
						}
					});
				});

				expect(invalidFields).toEqual([]);
			});

			it("should have validClassIds as array when present", () => {
				if (!eventData?.possibilities) return;

				const invalidFields: string[] = [];
				
				Object.entries(eventData.possibilities).forEach(([possibilityKey, possibility]: [string, any]) => {
					if (!possibility.outcomes) return;
					
					Object.entries(possibility.outcomes).forEach(([outcomeKey, outcome]: [string, any]) => {
						if (!outcome.requirements?.validClassIds) return;
						
						if (!Array.isArray(outcome.requirements.validClassIds)) {
							invalidFields.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.validClassIds should be array, got ${typeof outcome.requirements.validClassIds}`);
						} else {
							// Vérifier que tous les éléments sont des nombres
							outcome.requirements.validClassIds.forEach((id: any, index: number) => {
								if (typeof id !== "number") {
									invalidFields.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.validClassIds[${index}] should be number, got ${typeof id}`);
								}
							});
						}
					});
				});

				expect(invalidFields).toEqual([]);
			});

			it("should only contain valid requirement properties", () => {
				if (!eventData?.possibilities) return;

				const invalidProperties: string[] = [];
				
				Object.entries(eventData.possibilities).forEach(([possibilityKey, possibility]: [string, any]) => {
					if (!possibility.outcomes) return;
					
					Object.entries(possibility.outcomes).forEach(([outcomeKey, outcome]: [string, any]) => {
						if (!outcome.requirements) return;
						
						Object.keys(outcome.requirements).forEach(reqKey => {
							if (!validRequirements.includes(reqKey)) {
								invalidProperties.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.${reqKey} is not a valid requirement property`);
							}
						});
					});
				});

				expect(invalidProperties).toEqual([]);
			});

			it("should have correct structure for range-based requirements", () => {
				if (!eventData?.possibilities) return;

				const invalidRanges: string[] = [];
				const rangeBasedRequirements = ["level", "karma", "health", "defense", "attack", "speed", "petRarity"];
				
				Object.entries(eventData.possibilities).forEach(([possibilityKey, possibility]: [string, any]) => {
					if (!possibility.outcomes) return;
					
					Object.entries(possibility.outcomes).forEach(([outcomeKey, outcome]: [string, any]) => {
						if (!outcome.requirements) return;
						
						rangeBasedRequirements.forEach(reqType => {
							const requirement = outcome.requirements[reqType];
							if (!requirement) return;
							
							if (typeof requirement !== "object" || requirement === null) {
								invalidRanges.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.${reqType} should be an object`);
								return;
							}
							
							// Vérifier que min et max sont des nombres si présents
							if (requirement.min !== undefined && typeof requirement.min !== "number") {
								invalidRanges.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.${reqType}.min should be a number`);
							}
							
							if (requirement.max !== undefined && typeof requirement.max !== "number") {
								invalidRanges.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.${reqType}.max should be a number`);
							}
							
							// Vérifier qu'au moins min ou max est défini
							if (requirement.min === undefined && requirement.max === undefined) {
								invalidRanges.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.${reqType} should have at least min or max defined`);
							}
						});
					});
				});

				expect(invalidRanges).toEqual([]);
			});

			it("should have campaignCurrentMissionId as number when present", () => {
				if (!eventData?.possibilities) return;

				const invalidFields: string[] = [];
				
				Object.entries(eventData.possibilities).forEach(([possibilityKey, possibility]: [string, any]) => {
					if (!possibility.outcomes) return;
					
					Object.entries(possibility.outcomes).forEach(([outcomeKey, outcome]: [string, any]) => {
						if (!outcome.requirements?.campaignCurrentMissionId) return;
						
						if (typeof outcome.requirements.campaignCurrentMissionId !== "number") {
							invalidFields.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.campaignCurrentMissionId should be number, got ${typeof outcome.requirements.campaignCurrentMissionId}`);
						}
					});
				});

				expect(invalidFields).toEqual([]);
			});
		});
	});
});
