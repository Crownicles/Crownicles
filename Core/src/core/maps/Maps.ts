import Player from "../database/game/models/Player";
import { TravelTime } from "./TravelTime";
import { MapConstants } from "../../../../Lib/src/constants/MapConstants";
import { MapCache } from "./MapCache";
import { Op } from "sequelize";
import { LogsReadRequests } from "../database/logs/LogsReadRequests";
import {
	MapLink, MapLinkDataController
} from "../../data/MapLink";
import {
	MapLocation, MapLocationDataController
} from "../../data/MapLocation";
import { crowniclesInstance } from "../../index";
import { CrowniclesPacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import { NumberChangeReason } from "../../../../Lib/src/constants/LogsConstants";
import { Settings } from "../database/game/models/Setting";
import { PVEConstants } from "../../../../Lib/src/constants/PVEConstants";
import { MissionsController } from "../missions/MissionsController";
import { minutesToMilliseconds } from "../../../../Lib/src/utils/TimeUtils";
import { CityDataController } from "../../data/City";

export type OptionsStartBoatTravel = {
	startTravelTimestamp: number;
	anotherMemberOnBoat: Player | null;
	price: number;
};

export class Maps {
	/**
	 * Returns the map ids a player can go to. It excludes the map the player is coming from if at least one map is available
	 * @param player
	 * @returns
	 */
	static getNextPlayerAvailableMaps(player: Player): number[] {
		if (!player.mapLinkId) {
			player.mapLinkId = MapLinkDataController.instance.getRandomLinkOnMainContinent().id;
		}

		const map = player.getDestinationId()!;
		const previousMap = player.getPreviousMapId()!;

		let nextMaps = MapLocationDataController.instance.getMapsConnectedIds(map, previousMap);

		// Don't allow going back to the city
		const city = CityDataController.instance.getCityByMapId(previousMap);
		if (city) {
			nextMaps = nextMaps.filter(id => !city.maps.includes(id));
		}

		if (nextMaps.length === 0 && previousMap) {
			nextMaps.push(previousMap);
		}
		return nextMaps;
	}

	/**
	 * Get connected map types. There can be duplicates if multiple maps have the same type
	 * @param player
	 * @param excludePlayerLink Exclude the player link from the types
	 */
	static getConnectedMapTypes(player: Player, excludePlayerLink: boolean): string[] {
		return (
			MapLocationDataController.instance.getMapTypesConnected(player.getDestinationId()!, excludePlayerLink
				? player.getPreviousMapId() ?? -1
				: -1)
		);
	}

	/**
	 * Make a player start travelling. It does not check if the player is currently travelling, if the maps are connected etc. It also saves the player
	 * @param player
	 * @param newLink
	 * @param time - The start time
	 * @returns
	 */
	static async startTravel(player: Player, newLink: MapLink, time: number): Promise<void> {
		player.mapLinkId = newLink.id;
		player.startTravelDate = new Date(time);
		await player.save();

		crowniclesInstance?.logsDatabase.logNewTravel(player.keycloakId, newLink)
			.then();
	}

	/**
	 * Make a player stop travelling. It saves the player
	 * @param player
	 * @returns
	 */
	static async stopTravel(player: Player): Promise<void> {
		player.startTravelDate = new Date();
		await player.save();
	}

	/**
	 * Check if the player has arrived at the destination
	 * @param player
	 * @param date
	 */
	static isArrived(player: Player, date: Date): boolean {
		return TravelTime.getTravelDataSimplified(player, date).travelEndTime <= date.valueOf();
	}

	/**
	 * Check if the player is travelling
	 * @param player
	 */
	static isTravelling(player: Player): boolean {
		return player.startTravelDate.valueOf() !== 0;
	}

	/**
	 * Check if the player is on a PVE map
	 * @param player
	 */
	static isOnPveIsland(player: Player): boolean {
		return MapCache.pveIslandMapLinks.includes(player.mapLinkId);
	}

	/**
	 * Check if the player is near the water
	 * @param player
	 */
	static isNearWater(player: Player): boolean {
		return MapConstants.WATER_MAP_LINKS.includes(player.mapLinkId);
	}

	/**
	 * Check if the player is on the boat going to the PVE island
	 * @param player
	 */
	static isOnBoat(player: Player): boolean {
		return MapCache.entryAndExitBoatMapLinks.includes(player.mapLinkId);
	}

	/**
	 * Check if the player is on a haunted path
	 * @param player
	 */
	static isOnHauntedPath(player: Player): boolean {
		return MapCache.hauntedMapLinks.includes(player.mapLinkId);
	}

	/**
	 * Check if the player is on a continent
	 * @param player
	 */
	static isOnContinent(player: Player): boolean {
		return MapCache.continentMapLinks.includes(player.mapLinkId);
	}

	/**
	 * Get all the members of the player's guild on the pve island
	 */
	static async getGuildMembersOnPveIsland(player: Player): Promise<Player[]> {
		if (!player.guildId) {
			return [];
		}

		const membersThatWere = await LogsReadRequests.getGuildMembersThatWereOnPveIsland(player);
		const membersThatWereKeycloakIds = membersThatWere.map(player => player.keycloakId);

		// Filter keycloak ids that are already in the first array, because even if the players are the same the model instances are different
		const membersThatAre = (await Player.findAll({
			where: {
				guildId: player.guildId,
				mapLinkId: {
					[Op.in]: MapCache.pveIslandMapLinks
				},
				id: { [Op.not]: player.id }
			}
		})).filter(player => !membersThatWereKeycloakIds.includes(player.keycloakId));
		return [...membersThatWere, ...membersThatAre];
	}

	/**
	 * Get all the members of the player's guild on a boat that can be joined
	 */
	static getGuildMembersOnBoat(player: Player): Promise<Player[]> {
		if (!player.guildId) {
			return Promise.resolve([]);
		}

		const minStartTravelDate = new Date(Date.now() - PVEConstants.TIME_AFTER_INACTIVITY_ON_BOAT_IS_NOT_ACCEPTED);

		return Player.findAll({
			where: {
				guildId: player.guildId,
				mapLinkId: {
					[Op.in]: MapCache.boatEntryMapLinks
				},
				id: { [Op.not]: player.id },
				startTravelDate: { [Op.gte]: minStartTravelDate }
			}
		});
	}

	/**
	 * Allow to start travel on the boat
	 * @param player
	 * @param options
	 * @param reason
	 * @param response
	 */
	static async startBoatTravel(player: Player, options: OptionsStartBoatTravel, reason: NumberChangeReason, response: CrowniclesPacket[]): Promise<void> {
		const missionInfo = await PlayerMissionsInfos.getOfPlayer(player.id);

		await TravelTime.removeEffect(player, reason);

		const mapLinkJoinBoat = MapLinkDataController.instance.getById(await Settings.PVE_ISLAND.getValue())!;
		const travelTime = minutesToMilliseconds(mapLinkJoinBoat.tripDuration);
		const otherPlayerStartTime = options.anotherMemberOnBoat ? options.anotherMemberOnBoat.startTravelDate.valueOf() : null;
		const timeSinceOtherPlayerStarted = Date.now() - (otherPlayerStartTime ?? 0);

		const finalStartTime = otherPlayerStartTime
			? timeSinceOtherPlayerStarted >= travelTime
				? Date.now() - travelTime
				: otherPlayerStartTime
			: options.startTravelTimestamp;


		await Maps.startTravel(
			player,
			mapLinkJoinBoat,
			finalStartTime
		);
		await missionInfo.spendGems(options.price, response, reason);
		await missionInfo.save();
		if (options.price === PVEConstants.TRAVEL_COST[PVEConstants.TRAVEL_COST.length - 1]) {
			await MissionsController.update(player, response, {
				missionId: "wealthyPayForPVEIsland"
			});
		}
	}

	/**
	 * Get the lost of all the mapLocations
	 */
	static getMaps(): MapLocation[] {
		return MapLocationDataController.instance.getAll();
	}
}
