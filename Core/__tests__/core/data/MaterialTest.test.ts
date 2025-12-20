import {readdirSync, readFileSync} from "node:fs";
import * as path from "node:path";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- JSON import is allowed via tsconfig in this project
import models from "../../../../Lang/fr/models.json";
import {describe, expect, it} from "vitest";
import {CrowniclesIcons} from "../../../../Lib/src/CrowniclesIcons";

// Helper to get material ID from filename (without extension)
const getMaterialIdFromFile = (fileName: string): string => {
	return path.parse(fileName).name;
};

// Helper to load a material JSON file
const loadMaterial = (materialsDir: string, fileName: string): any => {
	try {
		const fullPath = path.join(materialsDir, fileName);
		const raw = readFileSync(fullPath, "utf8");
		return JSON.parse(raw);
	}
	catch {
		throw new Error(`Failed to load or parse material file: ${fileName}`);
	}
};

// Helper to load a JSON file and fail with a clear message
const loadJsonFile = (dir: string, fileName: string): any => {
	const fullPath = path.join(dir, fileName);
	try {
		const raw = readFileSync(fullPath, "utf8");
		return JSON.parse(raw);
	}
	catch (error) {
		throw new Error(`Failed to load or parse JSON file '${fullPath}': ${(error as Error).message}`);
	}
};

describe("Materials consistency", () => {
	it("every material file has a translation and an icon, and vice versa", () => {
		// 1. Collect material IDs from Core/resources/materials (filenames)
		const materialsDir = path.join(__dirname, "../../../../Core/resources/materials");
		const materialFiles = readdirSync(materialsDir).filter((file) => file.endsWith(".json"));
		const materialIdsFromFiles = new Set(materialFiles.map(getMaterialIdFromFile));

		// 2. Collect material IDs from Lang/fr/models.json
		const materialIdsFromModels = new Set(Object.keys((models as any).materials ?? {}));

		// 3. Collect material IDs from Lib/src/CrowniclesIcons.ts
		const materialIdsFromIcons = new Set(Object.keys(CrowniclesIcons.materials ?? {}));

		// 4. All sources should define the exact same set of IDs
		const allIds = new Set<string>();
		materialIdsFromFiles.forEach((id) => allIds.add(id));
		materialIdsFromModels.forEach((id) => allIds.add(id));
		materialIdsFromIcons.forEach((id) => allIds.add(id));

		const missingInFiles: string[] = [];
		const missingInModels: string[] = [];
		const missingInIcons: string[] = [];

		allIds.forEach((id) => {
			if (!materialIdsFromFiles.has(id)) missingInFiles.push(id);
			if (!materialIdsFromModels.has(id)) missingInModels.push(id);
			if (!materialIdsFromIcons.has(id)) missingInIcons.push(id);
		});

		const buildMessage = (label: string, items: string[]): string =>
			items.length ? `\n${label}: ${items.sort().join(", ")}` : "";

		const errorMessage =
			"Material IDs mismatch between sources:" +
			buildMessage("Missing in Core/resources/materials", missingInFiles) +
			buildMessage("Missing in Lang/fr/models.json (materials)", missingInModels) +
			buildMessage("Missing in Lib/src/CrowniclesIcons.ts (materials)", missingInIcons);

		if (missingInFiles.length || missingInModels.length || missingInIcons.length) {
			throw new Error(errorMessage);
		}

		// Assert that there is at least one material to avoid false positives
		expect(allIds.size).toBeGreaterThan(0);
	});

	it("has exactly 3 materials for each type and rarity combination", () => {
		const materialsDir = path.join(__dirname, "../../../../Core/resources/materials");
		const materialFiles = readdirSync(materialsDir).filter((file) => file.endsWith(".json"));

		// Map: type -> rarity -> count
		const counts = new Map<string, Map<number, number>>();

		for (const file of materialFiles) {
			const material = loadMaterial(materialsDir, file);
			const {type, rarity} = material as {type?: string; rarity?: number};

			// Basic shape validation so the error message is explicit
			if (!type || (typeof type !== "string")) {
				throw new Error(`Material '${file}' is missing a valid 'type' field`);
			}
			if (rarity !== 1 && rarity !== 2 && rarity !== 3) {
				throw new Error(`Material '${file}' has invalid 'rarity' (expected 1, 2 or 3, got: ${String(rarity)})`);
			}

			if (!counts.has(type)) counts.set(type, new Map<number, number>());
			const rarityMap = counts.get(type)!;
			rarityMap.set(rarity, (rarityMap.get(rarity) ?? 0) + 1);
		}

		const errors: string[] = [];

		counts.forEach((rarityMap, type) => {
			[1, 2, 3].forEach((rarity) => {
				const count = rarityMap.get(rarity) ?? 0;
				if (count !== 3) {
					errors.push(`type='${type}', rarity=${rarity} => expected 3 materials, found ${count}`);
				}
			});
		});

		if (errors.length > 0) {
			throw new Error(`Invalid materials distribution by type/rarity:\n${errors.join("\n")}`);
		}
	});

	it("armors and weapons must have a valid type value", () => {
		const coreResourcesDir = path.join(__dirname, "../../../../Core/resources");

		const allowedTypes = new Set([
			"magic",
			"metal",
			"wood",
			"rope",
			"alloy",
			"poison",
			"explosive",
			"spiritual",
			"nature",
			"leather",
		]);

		const checkDirectory = (subDir: string): void => {
			const dir = path.join(coreResourcesDir, subDir);
			const files = readdirSync(dir).filter((file) => file.endsWith(".json"));

			for (const file of files) {
				const json = loadJsonFile(dir, file);

				if (file === "0.json") {
					// 0.json is allowed to have `type: null`
					if (!Object.prototype.hasOwnProperty.call(json, "type")) {
						throw new Error(`${subDir}/${file} is missing required 'type' field (expected null)`);
					}
					if (json.type !== null) {
						throw new Error(`${subDir}/${file} should have type=null, got: ${JSON.stringify(json.type)}`);
					}
				}
				else {
					if (!Object.prototype.hasOwnProperty.call(json, "type")) {
						throw new Error(`${subDir}/${file} is missing required 'type' field`);
					}
					if (!allowedTypes.has(json.type)) {
						throw new Error(
							`${subDir}/${file} has invalid type '${String(
								json.type,
							)}' (allowed: ${Array.from(allowedTypes).sort().join(", ")}, or null only for 0.json)`,
						);
					}
				}
			}
		};

		checkDirectory("armors");
		checkDirectory("weapons");
	});

	it("material IDs must be valid 8-bit numbers (1-255)", () => {
		const materialsDir = path.join(__dirname, "../../../../Core/resources/materials");
		const materialFiles = readdirSync(materialsDir).filter((file) => file.endsWith(".json"));

		const invalidIds: string[] = [];

		for (const file of materialFiles) {
			const id = getMaterialIdFromFile(file);
			const numericId = parseInt(id, 10);

			// Check if ID is a valid number between 1 and 255 (8-bit range)
			if (isNaN(numericId) || numericId < 1 || numericId > 255 || id !== String(numericId)) {
				invalidIds.push(`${id} (from ${file})`);
			}
		}

		if (invalidIds.length > 0) {
			throw new Error(
				`Found invalid material IDs (must be numbers between 1 and 255):\n${invalidIds
					.sort()
					.join("\n")}`,
			);
		}
	});
});
