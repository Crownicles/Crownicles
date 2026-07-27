import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";

interface MapLocationResource {
	type: string;
	expeditionType?: ExpeditionLocationType;
	attribute: string;
}

interface MapLocationEntry extends MapLocationResource {
	id: number;
}

const MAP_LOCATIONS_DIR = path.join(__dirname, "../../../resources/mapLocations");
const MAIN_CONTINENT_ATTRIBUTE = "continent1";
const MAX_MAIN_CONTINENT_BIOME_SHARE = 0.45;
const MIN_SPECIALIZED_BIOME_LOCATIONS = 2;

function loadMapLocations(): MapLocationEntry[] {
	return readdirSync(MAP_LOCATIONS_DIR)
		.filter(file => file.endsWith(".json"))
		.map(file => ({
			id: Number.parseInt(file, 10),
			...JSON.parse(readFileSync(path.join(MAP_LOCATIONS_DIR, file), "utf8")) as MapLocationResource
		}));
}

function resolveBiome(location: MapLocationResource): ExpeditionLocationType {
	return location.expeditionType
		?? ExpeditionConstants.MAP_TYPE_TO_EXPEDITION_TYPE[location.type];
}

describe("expedition biome data", () => {
	const locations = loadMapLocations();

	it("maps every map location type to an expedition biome", () => {
		const unmappedLocations = locations
			.filter(location => !ExpeditionConstants.MAP_TYPE_TO_EXPEDITION_TYPE[location.type])
			.map(location => `${location.id}:${location.type}`);

		expect(unmappedLocations).toEqual([]);
	});

	it("only keeps expedition overrides that change the derived biome", () => {
		const redundantOverrides = locations
			.filter(location => location.expeditionType === ExpeditionConstants.MAP_TYPE_TO_EXPEDITION_TYPE[location.type])
			.map(location => location.id);

		expect(redundantOverrides).toEqual([]);
	});

	it("keeps the main continent biome distribution varied", () => {
		const mainContinentLocations = locations.filter(location => location.attribute === MAIN_CONTINENT_ATTRIBUTE);
		const biomeCounts = new Map<ExpeditionLocationType, number>();
		for (const location of mainContinentLocations) {
			const biome = resolveBiome(location);
			biomeCounts.set(biome, (biomeCounts.get(biome) ?? 0) + 1);
		}

		const specializedBiomeCounts = [...biomeCounts.entries()]
			.filter(([biome]) => biome !== ExpeditionConstants.EXPEDITION_LOCATION_TYPES.PLAINS)
			.map(([, count]) => count);
		const dominantBiomeShare = Math.max(...biomeCounts.values()) / mainContinentLocations.length;

		expect(specializedBiomeCounts.every(count => count >= MIN_SPECIALIZED_BIOME_LOCATIONS)).toBe(true);
		expect(dominantBiomeShare).toBeLessThanOrEqual(MAX_MAIN_CONTINENT_BIOME_SHARE);
	});

	it("configures rewards, difficulty and loot for every used biome", () => {
		const usedBiomes = new Set(locations.map(resolveBiome));
		for (const biome of usedBiomes) {
			expect(ExpeditionConstants.LOCATION_REWARD_WEIGHTS[biome]).toBeDefined();
			expect(ExpeditionConstants.TERRAIN_DIFFICULTY[biome]).toBeDefined();
			expect(ExpeditionConstants.EXPEDITION_LOOT_TABLES[biome]).toBeDefined();
		}
	});
});
