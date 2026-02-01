import { DataControllerNumber } from "./DataController";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";
import { MapLocationDataController } from "./MapLocation";
import { Data } from "./Data";
import { MapConstants } from "../../../Lib/src/constants/MapConstants";

export class MapLink extends Data<number> {
	public readonly startMap!: number;

	public readonly endMap!: number;

	public readonly tripDuration!: number;

	public readonly forcedImage?: string;
}

export class MapLinkDataController extends DataControllerNumber<MapLink> {
	static readonly instance: MapLinkDataController = new MapLinkDataController("mapLinks");

	/**
	 * Generate a random map link different from the current one
	 * @param currentMapLinkId
	 */
	public generateRandomMapLinkDifferentOfCurrent(currentMapLinkId: number): MapLink {
		let generatedMapLink = this.getRandomLinkOnMainContinent();
		if (generatedMapLink.id === currentMapLinkId) { // If the player is already on the destination, get the inverse link
			generatedMapLink = this.getInverseLinkOf(currentMapLinkId)!;
		}
		return generatedMapLink;
	}

	newInstance(): MapLink {
		return new MapLink();
	}

	/**
	 * Return a random MapLink from the main continent
	 */
	public getRandomLinkOnMainContinent(): MapLink {
		const mapLinks = this.getValuesArray()
			.filter(mapLink => {
				const startMap = MapLocationDataController.instance.getById(mapLink.startMap);
				const endMap = MapLocationDataController.instance.getById(mapLink.endMap);
				return startMap?.attribute === MapConstants.MAP_ATTRIBUTES.CONTINENT1 && endMap?.attribute === MapConstants.MAP_ATTRIBUTES.CONTINENT1;
			});
		return RandomUtils.crowniclesRandom.pick(mapLinks);
	}

	/**
	 * Get a MapLink by its start and end points
	 * @param idStartPoint
	 * @param idEndPoint
	 */
	public getLinkByLocations(idStartPoint: number, idEndPoint: number): MapLink | undefined {
		return this.getValuesArray()
			.find(mapLink => mapLink.startMap === idStartPoint && mapLink.endMap === idEndPoint);
	}

	/**
	 * Get all the links starting from a map
	 * @param idStartPoint
	 */
	public getLinksByMapStart(idStartPoint: number): MapLink[] {
		return this.getValuesArray()
			.filter(mapLink => mapLink.startMap === idStartPoint);
	}

	/**
	 * Get the inverse link of a map link (where start and end are inverted)
	 * @param idMapLink
	 */
	public getInverseLinkOf(idMapLink: number): MapLink | undefined {
		const currMapLink = this.data.get(idMapLink);
		if (!currMapLink) {
			return undefined;
		}
		return this.getValuesArray()
			.find(mapLink => mapLink.startMap === currMapLink.endMap && mapLink.endMap === currMapLink.startMap);
	}

	/**
	 * Get all the links starting from a map with specific types, also support a banlisted map
	 * @param mapTypes
	 * @param startMapId
	 * @param blacklistMapId
	 */
	public getMapLinksWithMapTypes(mapTypes: string[], startMapId: number, blacklistMapId: number): MapLink[] {
		const blackListId = blacklistMapId ?? -1;
		return this.getValuesArray()
			.filter(
				mapLink => mapLink.startMap === startMapId
					&& mapLink.endMap !== blackListId
					&& mapTypes.includes(MapLocationDataController.instance.getById(mapLink.endMap)?.type ?? "")
			);
	}

	/**
	 * Get all the links starting from a map with specific types that have a specific attribute
	 * @param attributeFrom
	 * @param attributeTo
	 */
	public getFromAttributeToAttribute(attributeFrom: string, attributeTo: string): MapLink[] {
		return this.getValuesArray()
			.filter(
				mapLink => {
					const startMap = MapLocationDataController.instance.getById(mapLink.startMap);
					const endMap = MapLocationDataController.instance.getById(mapLink.endMap);
					return startMap?.attribute === attributeFrom && endMap?.attribute === attributeTo;
				}
			);
	}

	public getAll(): MapLink[] {
		return this.getValuesArray();
	}
}
