import { DataControllerNumber } from "./DataController";
import { QueryTypes } from "sequelize";
import { MapLinkDataController } from "./MapLink";
import Player from "../core/database/game/models/Player";
import { Data } from "./Data";
import { MapLocationType } from "../../../Lib/src/constants/MapLocationConstants";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";
import { Biome } from "../../../Lib/src/types/Biome";

export class MapLocation extends Data<number> {
	declare readonly type: MapLocationType;

	declare readonly canBeGoToPlaceMissionDestination: boolean;

	declare readonly attribute: string;

	declare readonly forcedImage?: string;

	/**
	 * Optional city ID if this map location is in a city
	 */
	declare readonly cityId: number | null;

	/**
	 * Biomes of this map location (terrains used for expeditions and material loot), independent of its structural type.
	 * A location can mix several terrains, e.g. a mountain whose flanks are riddled with caves.
	 */
	declare readonly biomes: readonly Biome[];

	/**
	 * Pick one of the biomes of this map location
	 */
	public pickBiome(): Biome {
		return RandomUtils.crowniclesRandom.pick(this.biomes);
	}

	/**
	 * Count all players that have the given map as their current map of origin
	 * @param originId
	 */
	public async playersCount(originId: number): Promise<number> {
		const mapLink1 = MapLinkDataController.instance.getLinkByLocations(originId, this.id);
		const mapLink2 = MapLinkDataController.instance.getLinkByLocations(this.id, originId);

		const query = `SELECT COUNT(*) as count
                       FROM players
                       WHERE mapLinkId = :id1
                          OR mapLinkId = :id2;`;
		return (<{
			count: number;
		}[]>(await Player.sequelize!.query(query, {
			replacements: {
				id1: mapLink1?.id ?? -1,
				id2: mapLink2?.id ?? -1
			},
			type: QueryTypes.SELECT
		})))[0].count;
	}
}

export class MapLocationDataController extends DataControllerNumber<MapLocation> {
	static readonly instance: MapLocationDataController = new MapLocationDataController("mapLocations");

	private missionsMapsCache: MapLocation[] | null = null;

	newInstance(): MapLocation {
		return new MapLocation();
	}

	public getAll(): MapLocation[] {
		return this.getValuesArray();
	}

	/**
	 * Get a random map where the player can go for a mission
	 */
	public getRandomGotoableMap(): MapLocation {
		if (!this.missionsMapsCache) {
			this.missionsMapsCache = this.getValuesArray()
				.filter(map => map.canBeGoToPlaceMissionDestination);
		}

		return RandomUtils.crowniclesRandom.pick(this.missionsMapsCache);
	}

	/**
	 * Get the list of mapLocations that are connected to the mapLocation with the given id
	 * @param mapId
	 * @param blacklistId
	 */
	public getMapsConnectedIds(mapId: number, blacklistId: number): number[] {
		return this.getValuesArray()
			.filter(
				map => map.id !== blacklistId
					&& MapLinkDataController.instance
						.getLinksByMapStart(mapId)
						.map(map2 => map2.endMap)
						.includes(map.id)
			)
			.map(map => map.id);
	}

	/**
	 * Get all mapLocation types adjacent to the given mapLocation id
	 * @param mapId
	 * @param blacklistId
	 */
	public getMapTypesConnected(mapId: number, blacklistId: number): string[] {
		return this.getValuesArray()
			.filter(
				map => map.id !== blacklistId
					&& MapLinkDataController.instance
						.getLinksByMapStart(mapId)
						.map(map2 => map2.endMap)
						.includes(map.id)
			)
			.map(map => map.type);
	}

	/**
	 * Get the list of mapLocations that match one or more attribute(s).
	 * @param attributes
	 */
	public getWithAttributes(attributes: string[]): MapLocation[] {
		return this.getValuesArray()
			.filter(map => attributes.includes(map.attribute));
	}

	/**
	 * Get the list of players who are on the indicated path
	 * @param mapId
	 * @param previousMapId
	 * @param playerId
	 */
	public async getPlayersOnMap(mapId: number, previousMapId: number, playerId: number): Promise<{
		keycloakId: string;
	}[]> {
		const mapLink1 = MapLinkDataController.instance.getLinkByLocations(previousMapId, mapId);
		const mapLink2 = MapLinkDataController.instance.getLinkByLocations(mapId, previousMapId);

		const query = `SELECT keycloakId
                       FROM players
                       WHERE players.id != :playerId
						 AND players.mapLinkId = :id1
					       OR players.mapLinkId = :id2
                       ORDER BY RAND();`;
		return await Player.sequelize!.query(query, {
			replacements: {
				playerId,
				id1: mapLink1?.id ?? -1,
				id2: mapLink2?.id ?? -1
			},
			type: QueryTypes.SELECT
		});
	}
}
