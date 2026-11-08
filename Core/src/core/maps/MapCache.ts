import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { RandomUtils } from "../../../../Lib/src/utils/RandomUtils";
import { LogsMapLinks } from "../database/logs/models/LogsMapLinks";
import {
	Op, Sequelize
} from "sequelize";
import { MapLinkDataController } from "../../data/MapLink";
import { MapLocationDataController } from "../../data/MapLocation";

export abstract class MapCache {
	static boatEntryMapLinks: number[];

	static boatExitMapLinks: number[];

	static entryAndExitBoatMapLinks: number[];

	static regenEnergyMapLinks: number[];

	static pveIslandMapLinks: number[];

	static allPveMapLinks: number[];

	static continentMapLinks: number[];

	static logsPveIslandMapLinks: number[];

	static hauntedMapLinks: number[];

	static finalPveBossMapIds: number[];

	/**
	 * Depth of each PVE island location: 1 for the locations reached from the island entry, 2 for the next ones...
	 */
	static pveIslandMapDepths: Map<number, number>;

	/**
	 * Give a depth to the PVE island locations reachable from a location which do not have one yet
	 * @param mapId
	 * @param depths
	 * @param depth
	 * @returns The locations which just got a depth
	 */
	private static visitPveIslandNeighbours(mapId: number, depths: Map<number, number>, depth: number): number[] {
		const neighbours = MapLinkDataController.instance.getLinksByMapStart(mapId)
			.map(link => link.endMap)
			.filter(endMap => !depths.has(endMap)
				&& MapLocationDataController.instance.getById(endMap)?.attribute === MapConstants.MAP_ATTRIBUTES.PVE_ISLAND);
		for (const neighbour of neighbours) {
			depths.set(neighbour, depth);
		}
		return neighbours;
	}

	/**
	 * Compute the depth of each PVE island location with a breadth-first search from the island entries
	 */
	static computePveIslandMapDepths(): Map<number, number> {
		const depths = new Map<number, number>();
		let frontier = MapLocationDataController.instance.getWithAttributes([MapConstants.MAP_ATTRIBUTES.PVE_ISLAND_ENTRY])
			.map(location => location.id);
		for (let depth = 1; frontier.length > 0; depth++) {
			frontier = frontier.flatMap(mapId => this.visitPveIslandNeighbours(mapId, depths, depth));
		}
		return depths;
	}

	static async init(): Promise<void> {
		// Boat links entry only
		const boatEntryMapLinksObjects = MapLinkDataController.instance.getFromAttributeToAttribute(MapConstants.MAP_ATTRIBUTES.MAIN_CONTINENT, MapConstants.MAP_ATTRIBUTES.PVE_ISLAND_ENTRY);
		this.boatEntryMapLinks = boatEntryMapLinksObjects
			.map(mapLink => mapLink.id);

		// Boat links exit only
		const boatExitMapLinksObjects = MapLinkDataController.instance.getFromAttributeToAttribute(MapConstants.MAP_ATTRIBUTES.PVE_EXIT, MapConstants.MAP_ATTRIBUTES.CONTINENT1);
		this.boatExitMapLinks = boatExitMapLinksObjects
			.map(mapLink => mapLink.id);

		// Boat links entry and exit
		this.entryAndExitBoatMapLinks = this.boatEntryMapLinks.concat(this.boatExitMapLinks);

		// PVE island map links
		const pveIslandMapLinksObjects = MapLinkDataController.instance.getFromAttributeToAttribute(MapConstants.MAP_ATTRIBUTES.PVE_ISLAND_ENTRY, MapConstants.MAP_ATTRIBUTES.PVE_ISLAND)
			.concat(MapLinkDataController.instance.getFromAttributeToAttribute(MapConstants.MAP_ATTRIBUTES.PVE_ISLAND, MapConstants.MAP_ATTRIBUTES.PVE_ISLAND));
		this.pveIslandMapLinks = pveIslandMapLinksObjects
			.map(pveLink => pveLink.id);

		/*
		 * Get the logs equivalence
		 * First create a list of literal tuples (because I didn't find how to do it in sequelize)
		 */
		const pveMapTuples = pveIslandMapLinksObjects
			.map(mapLink => Sequelize.literal(`(${mapLink.startMap},${mapLink.endMap})`));
		this.logsPveIslandMapLinks = (await LogsMapLinks.findAll({
			where: {
				[Op.and]: [ // We need an and to be able to create a column with a custom name
					Sequelize.where(Sequelize.literal("(start,end)"), { [Op.in]: pveMapTuples })
				]
			}
		})).map(mapLink => mapLink.id);

		// All PVE links
		this.allPveMapLinks = MapLinkDataController.instance.getFromAttributeToAttribute(MapConstants.MAP_ATTRIBUTES.MAIN_CONTINENT, MapConstants.MAP_ATTRIBUTES.PVE_ISLAND_ENTRY)
			.concat(MapLinkDataController.instance.getFromAttributeToAttribute(MapConstants.MAP_ATTRIBUTES.PVE_ISLAND, MapConstants.MAP_ATTRIBUTES.PVE_EXIT))
			.concat(MapLinkDataController.instance.getFromAttributeToAttribute(MapConstants.MAP_ATTRIBUTES.PVE_EXIT, MapConstants.MAP_ATTRIBUTES.CONTINENT1))
			.map(pveLink => pveLink.id)
			.concat(this.pveIslandMapLinks);

		this.hauntedMapLinks = MapLinkDataController.instance.getFromAttributeToAttribute(MapConstants.MAP_ATTRIBUTES.HAUNTED, MapConstants.MAP_ATTRIBUTES.HAUNTED)
			.map(mapLink => mapLink.id);

		// Final PVE boss locations: pve_island locations whose only outgoing links go to pve_exit (dead-ends)
		const pveIslandLocations = MapLocationDataController.instance.getWithAttributes([MapConstants.MAP_ATTRIBUTES.PVE_ISLAND]);
		this.finalPveBossMapIds = pveIslandLocations
			.filter(location => {
				const outgoingLinks = MapLinkDataController.instance.getLinksByMapStart(location.id);
				return outgoingLinks.length > 0 && outgoingLinks.every(link => {
					const endMap = MapLocationDataController.instance.getById(link.endMap);
					return endMap?.attribute === MapConstants.MAP_ATTRIBUTES.PVE_EXIT;
				});
			})
			.map(location => location.id);

		this.pveIslandMapDepths = this.computePveIslandMapDepths();

		// Fight regen list
		this.regenEnergyMapLinks = MapLinkDataController.instance.getAll()
			.map(mapLink => mapLink.id)
			.filter(mapLinkId => !this.allPveMapLinks.includes(mapLinkId));

		// Continent maps (for now it's the same as fight regen maps, but later it may evolve, so we do this granularity
		this.continentMapLinks = this.regenEnergyMapLinks.filter(mapLinkId => !this.hauntedMapLinks.includes(mapLinkId));
	}

	/**
	 * Get a random pve boat link id
	 * @param excludeLinkId Exclude this link id from being returned if another one is available
	 */
	static randomPveBoatLinkId(excludeLinkId = -1): number {
		if (MapCache.boatEntryMapLinks.length === 1) {
			return MapCache.boatEntryMapLinks[0];
		}

		return RandomUtils.crowniclesRandom.pick(MapCache.boatEntryMapLinks.filter(id => excludeLinkId !== id));
	}
}
