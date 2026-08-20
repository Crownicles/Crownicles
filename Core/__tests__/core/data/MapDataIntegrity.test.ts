import { describe, expect, it } from "vitest";
import {
	readdirSync, readFileSync
} from "fs";
import { resolve } from "path";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";

type MapLinkData = {
	startMap: number;
	endMap: number;
};

const mapLocationsPath = resolve(__dirname, "../../../resources/mapLocations");
const mapLinksPath = resolve(__dirname, "../../../resources/mapLinks");

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
});
