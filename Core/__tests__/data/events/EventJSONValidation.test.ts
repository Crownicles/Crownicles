import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { MaterialType } from "../../../../Lib/src/types/MaterialType";
import { ItemEnchantment } from "../../../../Lib/src/types/ItemEnchantment";
import { EVENT_OUTCOME_BADGES } from "../../../../Lib/src/types/Badge";

const materialTypes: string[] = Object.values(MaterialType);
const enchantmentKinds = [...new Set(ItemEnchantment.getAllEnchantments().map(e => e.kind.id))];
const enchantmentTypes = [...new Set(ItemEnchantment.getAllEnchantments().map(e => e.kind.type.id))];
const weaponsDir = join(__dirname, "../../../resources/weapons");
const weaponTagsCarried = new Set<string>(
	readdirSync(weaponsDir)
		.filter(file => file.endsWith(".json"))
		.flatMap(file => (JSON.parse(readFileSync(join(weaponsDir, file), "utf8")).tags ?? []) as string[])
);
const petsDir = join(__dirname, "../../../resources/pets");
const petTagsCarried = new Set<string>(
	readdirSync(petsDir)
		.filter(file => file.endsWith(".json"))
		.flatMap(file => (JSON.parse(readFileSync(join(petsDir, file), "utf8")).tags ?? []) as string[])
);

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
		"petTags",
		"petRarity",
		"validClassIds",
		"cookingLevel",
		"materials",
		"enchantment",
		"weaponLevel",
		"armorLevel",
		"weaponTags",
		"badges"
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

			it("should only use pet tags that at least one pet carries", () => {
				if (!eventData?.possibilities) return;

				const invalidFields: string[] = [];
				Object.entries(eventData.possibilities).forEach(([possibilityKey, possibility]: [string, any]) => {
					Object.entries(possibility.outcomes ?? {}).forEach(([outcomeKey, outcome]: [string, any]) => {
						const petTags = outcome.requirements?.petTags;
						if (petTags === undefined) return;
						if (!Array.isArray(petTags) || petTags.length === 0) {
							invalidFields.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.petTags should be a non-empty array`);
							return;
						}
						petTags.filter((tag: unknown) => !petTagsCarried.has(tag as string))
							.forEach((tag: unknown) => invalidFields.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.petTags: no pet has the tag ${String(tag)}`));
					});
				});

				expect(invalidFields).toEqual([]);
			});

			it("should only use weapon tags that at least one weapon carries", () => {
				if (!eventData?.possibilities) return;

				const invalidFields: string[] = [];
				Object.entries(eventData.possibilities).forEach(([possibilityKey, possibility]: [string, any]) => {
					Object.entries(possibility.outcomes ?? {}).forEach(([outcomeKey, outcome]: [string, any]) => {
						const weaponTags = outcome.requirements?.weaponTags;
						if (weaponTags === undefined) return;
						if (!Array.isArray(weaponTags) || weaponTags.length === 0) {
							invalidFields.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.weaponTags should be a non-empty array`);
							return;
						}
						weaponTags.filter((tag: unknown) => !weaponTagsCarried.has(tag as string))
							.forEach((tag: unknown) => invalidFields.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.weaponTags: no weapon has the tag ${String(tag)}`));
					});
				});

				expect(invalidFields).toEqual([]);
			});

			it("should only use the badges allowed in event outcomes", () => {
				if (!eventData?.possibilities) return;

				const allowed: readonly string[] = EVENT_OUTCOME_BADGES;
				const invalidFields: string[] = [];
				Object.entries(eventData.possibilities).forEach(([possibilityKey, possibility]: [string, any]) => {
					Object.entries(possibility.outcomes ?? {}).forEach(([outcomeKey, outcome]: [string, any]) => {
						const badges = outcome.requirements?.badges;
						if (badges === undefined) return;
						if (!Array.isArray(badges) || badges.length === 0) {
							invalidFields.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.badges should be a non-empty array`);
							return;
						}
						badges.filter((badge: unknown) => !allowed.includes(badge as string))
							.forEach((badge: unknown) => invalidFields.push(`${possibilityKey}.outcomes.${outcomeKey}.requirements.badges: ${String(badge)} is not an event outcome badge`));
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
				const rangeBasedRequirements = ["level", "karma", "health", "defense", "attack", "speed", "petRarity", "cookingLevel", "weaponLevel", "armorLevel"];
				
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

			it("should only use known material types and enchantments", () => {
				if (!eventData?.possibilities) return;

				const invalidFields: string[] = [];

				Object.entries(eventData.possibilities).forEach(([possibilityKey, possibility]: [string, any]) => {
					Object.entries(possibility.outcomes ?? {}).forEach(([outcomeKey, outcome]: [string, any]) => {
						const path = `${possibilityKey}.outcomes.${outcomeKey}.requirements`;
						const { materials, enchantment } = outcome.requirements ?? {};
						if (materials?.type !== undefined && !materialTypes.includes(materials.type)) {
							invalidFields.push(`${path}.materials.type ${materials.type} is not a material type`);
						}
						if (enchantment?.slot !== undefined && !["weapon", "armor"].includes(enchantment.slot)) {
							invalidFields.push(`${path}.enchantment.slot ${enchantment.slot} should be weapon or armor`);
						}
						(enchantment?.types ?? []).filter((type: string) => !enchantmentTypes.includes(type))
							.forEach((type: string) => invalidFields.push(`${path}.enchantment.types ${type} is not an enchantment type`));
						(enchantment?.kinds ?? []).filter((kind: string) => !enchantmentKinds.includes(kind))
							.forEach((kind: string) => invalidFields.push(`${path}.enchantment.kinds ${kind} is not an enchantment kind`));
					});
				});

				expect(invalidFields).toEqual([]);
			});
		});
	});
});
