import { describe, expect, it } from "vitest";
import {
	readdirSync, readFileSync
} from "fs";
import { resolve } from "path";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { MapLocationConstants } from "../../../../Lib/src/constants/MapLocationConstants";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";

type MapLocationData = {
	type: string;
	attribute: string;
	biomes?: string[];
	biome?: string;
	expeditionType?: string;
};

type MapLinkData = {
	startMap: number;
	endMap: number;
};

const mapLocationsPath = resolve(__dirname, "../../../resources/mapLocations");
const frenchModelsPath = resolve(__dirname, "../../../../Lang/fr/models.json");
const frenchCommandsPath = resolve(__dirname, "../../../../Lang/fr/commands.json");
const mapLinksPath = resolve(__dirname, "../../../resources/mapLinks");

/**
 * Attributes of the ends of the map links where a pet expedition cannot be launched, mirroring MapCache.continentMapLinks:
 * the PVE island links and the links inside the haunted area. Expeditions are proposed on both ends of the other links.
 */
const NON_EXPEDITION_LINK_ATTRIBUTES: readonly (readonly [string, string])[] = [
	[MapConstants.MAP_ATTRIBUTES.MAIN_CONTINENT, MapConstants.MAP_ATTRIBUTES.PVE_ISLAND_ENTRY],
	[MapConstants.MAP_ATTRIBUTES.PVE_ISLAND_ENTRY, MapConstants.MAP_ATTRIBUTES.PVE_ISLAND],
	[MapConstants.MAP_ATTRIBUTES.PVE_ISLAND, MapConstants.MAP_ATTRIBUTES.PVE_ISLAND],
	[MapConstants.MAP_ATTRIBUTES.PVE_ISLAND, MapConstants.MAP_ATTRIBUTES.PVE_EXIT],
	[MapConstants.MAP_ATTRIBUTES.PVE_EXIT, MapConstants.MAP_ATTRIBUTES.CONTINENT1],
	[MapConstants.MAP_ATTRIBUTES.HAUNTED, MapConstants.MAP_ATTRIBUTES.HAUNTED]
];

function readIds(path: string): number[] {
	return readdirSync(path)
		.filter(file => file.endsWith(".json"))
		.map(file => Number(file.replace(".json", "")));
}

function readMapLinks(): Map<number, MapLinkData> {
	const links = new Map<number, MapLinkData>();
	for (const id of readIds(mapLinksPath)) {
		links.set(id, JSON.parse(readFileSync(resolve(mapLinksPath, `${id}.json`), "utf-8")) as MapLinkData);
	}
	return links;
}

function readMapLocation(id: number): MapLocationData {
	return JSON.parse(readFileSync(resolve(mapLocationsPath, `${id}.json`), "utf-8")) as MapLocationData;
}

describe("Map data integrity", () => {
	const mapLocationIds = new Set(readIds(mapLocationsPath));
	const mapLinks = readMapLinks();

	/*
	 * Map location ids are sparse: a location can be removed without renumbering the others, so
	 * nothing may iterate over a contiguous id range or derive an id by arithmetic. These checks
	 * catch the references that such a removal would leave dangling.
	 */
	it("every map link points to existing map locations", () => {
		const danglingLinks = [...mapLinks.entries()]
			.filter(([, link]) => !mapLocationIds.has(link.startMap) || !mapLocationIds.has(link.endMap))
			.map(([id, link]) => `${id} (${link.startMap} -> ${link.endMap})`);

		expect(danglingLinks).toEqual([]);
	});

	it("every map location id referenced by MapConstants.LOCATIONS_IDS exists", () => {
		const missing = Object.entries(MapConstants.LOCATIONS_IDS)
			.filter(([, id]) => !mapLocationIds.has(id))
			.map(([name, id]) => `${name} = ${id}`);

		expect(missing).toEqual([]);
	});

	it("every map link id referenced by MapConstants.WATER_MAP_LINKS exists", () => {
		const missing = MapConstants.WATER_MAP_LINKS.filter(id => !mapLinks.has(id));

		expect(missing).toEqual([]);
	});

	it("every map location is reachable through at least one map link", () => {
		const reachable = new Set<number>();
		for (const link of mapLinks.values()) {
			reachable.add(link.startMap);
			reachable.add(link.endMap);
		}
		const unreachable = [...mapLocationIds].filter(id => !reachable.has(id));

		expect(unreachable).toEqual([]);
	});

	it("every map location type is declared in MapLocationConstants.TYPES", () => {
		const knownTypes: readonly string[] = Object.values(MapLocationConstants.TYPES);
		const unknown = [...mapLocationIds]
			.map(id => ({
				id,
				type: readMapLocation(id).type
			}))
			.filter(({ type }) => !knownTypes.includes(type))
			.map(({ id, type }) => `${id} (type '${type}')`);

		expect(unknown).toEqual([]);
	});

	it("every map location declares a non-empty list of distinct and valid biomes", () => {
		const biomes: readonly string[] = Object.values(ExpeditionConstants.EXPEDITION_LOCATION_TYPES);
		const invalid = [...mapLocationIds]
			.map(id => ({
				id,
				mapLocation: readMapLocation(id)
			}))
			.filter(({ mapLocation }) => !Array.isArray(mapLocation.biomes)
				|| mapLocation.biomes.length === 0
				|| new Set(mapLocation.biomes).size !== mapLocation.biomes.length
				|| mapLocation.biomes.some(biome => !biomes.includes(biome))
				|| mapLocation.biome !== undefined
				|| mapLocation.expeditionType !== undefined)
			.map(({ id, mapLocation }) => `${id} (biomes ${JSON.stringify(mapLocation.biomes)})`);

		expect(invalid).toEqual([]);
	});

	it("every biome of an expedition location has its own French expedition name, and every name matches a biome", () => {
		const expeditionNames = (JSON.parse(readFileSync(frenchCommandsPath, "utf-8")) as {
			petExpedition: { mapLocationExpeditions: Record<string, string> };
		}).petExpedition.mapLocationExpeditions;
		const expeditionLocationIds = new Set([...mapLinks.values()]
			.filter(link => !NON_EXPEDITION_LINK_ATTRIBUTES.some(([start, end]) => readMapLocation(link.startMap).attribute === start
				&& readMapLocation(link.endMap).attribute === end))
			.flatMap(link => [link.startMap, link.endMap]));
		const expectedKeys = [...expeditionLocationIds]
			.map(id => ({
				id,
				mapLocation: readMapLocation(id)
			}))
			.flatMap(({ id, mapLocation }) => {
				const biomes = mapLocation.biomes ?? [];
				return biomes.length === 1 ? [String(id)] : biomes.map(biome => `${id}_${biome}`);
			})
			.sort();

		expect(Object.keys(expeditionNames).sort()).toEqual(expectedKeys);
	});

	it("every biome can be reached by expeditions on the main continent", () => {
		const continentBiomes = new Set([...mapLocationIds]
			.map(readMapLocation)
			.filter(mapLocation => mapLocation.attribute === MapConstants.MAP_ATTRIBUTES.CONTINENT1)
			.flatMap(mapLocation => mapLocation.biomes ?? []));

		const missing = Object.values(ExpeditionConstants.EXPEDITION_LOCATION_TYPES).filter(biome => !continentBiomes.has(biome));

		expect(missing).toEqual([]);
	});

	it("every biome is offered by two neighbouring locations of the main continent, so a player can loop on it", () => {
		const continentIds = [...mapLocationIds].filter(id => readMapLocation(id).attribute === MapConstants.MAP_ATTRIBUTES.CONTINENT1);
		const offers = (id: number, biome: string): boolean => readMapLocation(id).biomes?.includes(biome) ?? false;
		const withoutLoop = Object.values(ExpeditionConstants.EXPEDITION_LOCATION_TYPES)
			.filter(biome => ![...mapLinks.values()].some(link => continentIds.includes(link.startMap)
				&& continentIds.includes(link.endMap)
				&& offers(link.startMap, biome)
				&& offers(link.endMap, biome)));

		expect(withoutLoop).toEqual([]);
	});

	it("every map location type has a French name, a prefix and an icon", () => {
		const mapTypeTranslations = (JSON.parse(readFileSync(frenchModelsPath, "utf-8")) as {
			map_types: Record<string, { name?: string; prefix?: string } | undefined>;
		}).map_types;
		const icons: Record<string, string | undefined> = CrowniclesIcons.mapTypes;

		const incomplete = Object.values(MapLocationConstants.TYPES)
			.filter(type => mapTypeTranslations[type]?.name === undefined || !mapTypeTranslations[type]?.prefix || !icons[type]);

		expect(incomplete).toEqual([]);
	});

	it("every map location type has its own icon", () => {
		const icons = Object.values(MapLocationConstants.TYPES).map(type => CrowniclesIcons.mapTypes[type]);

		expect(new Set(icons).size).toBe(icons.length);
	});
});
