import {LogsDailyPotions} from "./models/LogsDailyPotions";
import {LogsClassicalShopBuyouts} from "./models/LogsClassicalShopBuyouts";
import {HasOne, Op} from "sequelize";
import {ShopItemType} from "../../../../../Lib/src/constants/LogsConstants";
import {LogsDatabase} from "./LogsDatabase";
import {LogsPlayersPossibilities} from "./models/LogsPlayersPossibilities";
import {LogsPossibilities} from "./models/LogsPossibilities";
import {LogsPlayers} from "./models/LogsPlayers";
import {LogsPlayersTravels} from "./models/LogsPlayersTravels";
import {
	dateToLogs,
	getNextSaturdayMidnight,
	getNextSundayMidnight, getTodayMidnight,
	hoursToMilliseconds,
	minutesToMilliseconds
} from "../../../../../Lib/src/utils/TimeUtils";
import {LogsMapLinks} from "./models/LogsMapLinks";
import {MapConstants} from "../../../../../Lib/src/constants/MapConstants";
import {LogsFightsResults} from "./models/LogsFightsResults";
import {LogsSeasonEnd} from "./models/LogsSeasonEnd";
import {LogsPlayerLeagueReward} from "./models/LogsPlayerLeagueReward";
import {LogsPlayersClassChanges} from "./models/LogsPlayersClassChanges";
import Player from "../game/models/Player";
import {MapCache} from "../../maps/MapCache";
import {PVEConstants} from "../../../../../Lib/src/constants/PVEConstants";
import {LogsGuildsJoins} from "./models/LogsGuildJoins";
import {LogsGuilds} from "./models/LogsGuilds";
import {MapLocationDataController} from "../../../data/MapLocation";

export type RankedFightResult = {
	won: number,
	lost: number,
	draw: number
};

export type PersonalFightDailySummary = {
	won: number,
	draw: number,
	played: number,
}

/**
 * This class is used to read some information in the log database in case it is needed for gameplay purposes
 */

export class LogsReadRequests {

	static async getLastTimeThePlayerHasEditedHisClass(playerKeycloakId: string): Promise<Date> {
		const logPlayer = await LogsDatabase.findOrCreatePlayer(playerKeycloakId);
		return LogsPlayersClassChanges.findOne({
			where: {
				playerId: logPlayer.id
			},
			order: [["date", "DESC"]],
			limit: 1
		})
			.then((res) => new Date(res ? res.date * 1000 : 0));
	}

	/**
	 * Get the amount of time a specific player has bought the daily potion since the last time it was reset
	 * @param playerKeycloakId - The keycloak id of the player we want to check on
	 */
	static async getAmountOfDailyPotionsBoughtByPlayer(playerKeycloakId: string): Promise<number> {
		const dateOfLastDailyPotionReset = await this.getDateOfLastDailyPotionReset();
		const logPlayer = await LogsDatabase.findOrCreatePlayer(playerKeycloakId);
		return LogsClassicalShopBuyouts.count({
			where: {
				playerId: logPlayer.id,
				shopItem: ShopItemType.DAILY_POTION,
				date: {
					[Op.gte]: dateOfLastDailyPotionReset
				}
			}
		});
	}

	/**
	 * Get all the members of the player's guild on the pve island
	 */
	static async getGuildMembersThatWereOnPveIsland(player: Player): Promise<Player[]> {
		if (!player.guildId) { // Player has no guild
			return Promise.resolve([]);
		}
		// Get all the players in the guild excluding the player
		const playersInGuild = await Player.findAll({
			where: {
				guildId: player.guildId,
				id: {
					[Op.not]: player.id
				}
			}
		});
		// Extract ids from players
		const ids = playersInGuild.map((player) => player.keycloakId);
		// Convert the players to log players
		const logsPlayers = await LogsPlayers.findAll({
			where: {
				keycloakId: {
					[Op.in]: ids
				}
			}
		});
		// Extract ids from players
		const logsPlayersIds = logsPlayers.map((logsPlayer) => logsPlayer.id);
		// Get travels from the last hours of guildsMembers
		const travelsInPveIsland = await LogsPlayersTravels.findAll({
			where: {
				mapLinkId: {
					[Op.in]: MapCache.logsPveIslandMapLinks
				},
				playerId: {
					[Op.in]: logsPlayersIds
				},
				date: {
					[Op.gt]: Math.floor((Date.now() - minutesToMilliseconds(PVEConstants.MINUTES_CHECKED_FOR_PLAYERS_THAT_WERE_ON_THE_ISLAND)) / 1000)
				}
			},
			group: ["playerId"],
			include: [{
				model: LogsPlayers,
				association: new HasOne(LogsPlayersTravels, LogsPlayers, {
					sourceKey: "playerId",
					foreignKey: "id",
					as: "LogsPlayer1"
				})
			}]
		}) as unknown as {
			LogsPlayer1: {
				keycloakId: string
			}
		}[];
		return await Player.findAll({
			where: {
				keycloakId: {
					[Op.in]: travelsInPveIsland.map((travelsInPveIsland) => travelsInPveIsland.LogsPlayer1.keycloakId)
				}
			}
		});
	}

	/**
	 * Get the date of the last daily potion reset
	 */
	static async getDateOfLastDailyPotionReset(): Promise<number> {
		const result = await LogsDailyPotions.findOne({
			order: [["date", "DESC"]]
		});
		if (result) {
			return result.date;
		}
		return 0;
	}

	/**
	 * Get the date of the last season reset
	 */
	static async getDateOfLastSeasonReset(): Promise<number> {
		const result = await LogsSeasonEnd.findOne({
			order: [["date", "DESC"]]
		});
		if (result) {
			return result.date;
		}
		return 0;
	}

	/**
	 * Get the date of the last season reset
	 */
	static async getDateOfLastLeagueReward(playerKeycloakId: string): Promise<number | null> {
		const logPlayer = await LogsDatabase.findOrCreatePlayer(playerKeycloakId);
		return LogsPlayerLeagueReward.findOne({
			order: [["date", "DESC"]],
			where: {
				playerId: logPlayer.id
			}
		})
			.then((result) => {
				if (result) {
					return result.date;
				}
				return null;
			});
	}

	/**
	 * Get the date of the last event id for the player
	 * @param keycloakId
	 * @param eventId
	 */
	static async getLastEventDate(keycloakId: string, eventId: number): Promise<Date | null> {
		// Get all possibilities id for the big event
		const possibilityIds = (await LogsPossibilities.findAll({
			where: {
				bigEventId: eventId
			}
		})).map((possibility) => possibility.id);

		// Get logs player id
		const playerId = (await LogsPlayers.findOne({
			where: {
				keycloakId
			}
		})).id;

		// Find the last one
		const lastEvent = await LogsPlayersPossibilities.findOne({
			order: [["date", "DESC"]],
			where: {
				possibilityId: {
					[Op.in]: possibilityIds
				},
				playerId
			}
		});

		return lastEvent ? new Date(lastEvent.date * 1000) : null;
	}

	/**
	 * Get the amount of time the player went on the PVE island this week
	 * @param keycloakId
	 * @param guildId
	 */
	static async getCountPVEIslandThisWeek(keycloakId: string, guildId: number): Promise<number> {
		if (guildId && await this.joinGuildThisWeekRequest(keycloakId, guildId)) {
			return PVEConstants.TRAVEL_COST.length;
		}

		return await this.travelsOnPveIslandsCountThisWeekRequest(keycloakId);
	}

	/**
	 * Check if the players have been defenders in a ranked fight since the last minute
	 * @param playerKeycloakIds - The array of player Keycloak IDs to check
	 * @param minutes - The number of minutes to check
	 * @returns An object mapping playerKeycloakIds to booleans indicating whether each player has been a defender
	 */
	static async hasBeenADefenderInRankedFightSinceMinutes(
		playerKeycloakIds: string[],
		minutes: number
	): Promise<{ [key: string]: boolean }> {
		interface LogsFightsResultsWithPlayer2 {
			LogsPlayer2: {
				keycloakId: string;
			};
		}

		const results = await LogsFightsResults.findAll({
			attributes: [],
			where: {
				date: {
					[Op.gt]: Math.floor((Date.now() - minutesToMilliseconds(minutes)) / 1000)
				},
				friendly: false
			},
			include: [
				{
					model: LogsPlayers,
					association: new HasOne(LogsFightsResults, LogsPlayers, {
						sourceKey: "player2Id",
						foreignKey: "id",
						as: "LogsPlayer2"
					}),
					attributes: ["keycloakId"],
					required: true, // Ensure only records with LogsPlayer2 are returned
					where: {
						keycloakId: {
							[Op.in]: playerKeycloakIds
						}
					}
				}
			]
		});

		const resultsWithPlayer2 = results as (typeof results[0] & LogsFightsResultsWithPlayer2)[];
		const foundKeycloakIds = new Set(
			resultsWithPlayer2.map((result) => result.LogsPlayer2.keycloakId)
		);
		return Object.fromEntries(
			playerKeycloakIds.map((id) => [id, foundKeycloakIds.has(id)])
		);
	}

	/**
	 * Get the personal fight daily summary of a player only for the fights he initiated
	 * @param playerKeycloakId
	 */
	static async getPersonalInitiatedFightDailySummary(playerKeycloakId: string): Promise<PersonalFightDailySummary> {
		const startTimestamp = dateToLogs(getTodayMidnight());

		// Find all ranked (non-friendly) fights for today initiated by the player
		const fights = await LogsFightsResults.findAll({
			where: {
				date: {[Op.gt]: startTimestamp},
				friendly: false,
				"$LogsPlayer1.keycloakId$": playerKeycloakId
			},
			include: [{
				model: LogsPlayers,
				association: new HasOne(LogsFightsResults, LogsPlayers, {
					sourceKey: "fightInitiatorId",
					foreignKey: "id",
					as: "LogsPlayer1"
				}),
				attributes: ["keycloakId"]
			}]
		});

		return {
			played: fights.length,
			won: fights.filter(fight => fight.winner === 1).length,
			draw: fights.filter(fight => fight.winner === 0).length
		};
	}


	/**
	 * Get the fights of a player against a specific other player this week
	 * @param attackerKeycloakId - The keycloak id of the attacker
	 * @param defenderKeycloakIds - The keycloak ids of the defenders
	 */
	static async getRankedFightsThisWeek(attackerKeycloakId: string, defenderKeycloakIds: string[]): Promise<Map<string, RankedFightResult>> {
		interface LogsFightsResultsWithPlayer2 {
			LogsPlayer2: {
				keycloakId: string;
			};
		}

		const results = await LogsFightsResults.findAll({
			where: {
				"$LogsPlayer1.keycloakId$": attackerKeycloakId,
				"$LogsPlayer2.keycloakId$": {[Op.in]: defenderKeycloakIds},
				date: {
					[Op.gt]: Math.floor((getNextSaturdayMidnight() - 7 * 24 * 60 * 60 * 1000) / 1000)
				},
				friendly: false
			},
			include: [{
				model: LogsPlayers,
				association: new HasOne(LogsFightsResults, LogsPlayers, {
					sourceKey: "fightInitiatorId",
					foreignKey: "id",
					as: "LogsPlayer1"
				})
			}, {
				model: LogsPlayers,
				association: new HasOne(LogsFightsResults, LogsPlayers, {
					sourceKey: "player2Id",
					foreignKey: "id",
					as: "LogsPlayer2"
				})
			}]
		});
		const fights = results as (typeof results[0] & LogsFightsResultsWithPlayer2)[];

		// Group fights by defenderKeycloakId
		const fightsByDefender = new Map<string, LogsFightsResults[]>();
		for (const fight of fights) {
			const defenderKeycloakId = fight.LogsPlayer2.keycloakId;
			if (!fightsByDefender.has(defenderKeycloakId)) {
				fightsByDefender.set(defenderKeycloakId, []);
			}
			fightsByDefender.get(defenderKeycloakId)!.push(fight);
		}

		// Calculate the bo3 for each defender
		const resultMap = new Map<string, RankedFightResult>();
		for (const [defenderKeycloakId, defenderFights] of fightsByDefender.entries()) {
			const rankedFightResult = this.parseFightListToRankedFightData(defenderFights);
			resultMap.set(defenderKeycloakId, rankedFightResult);
		}
		return resultMap;
	}


	/**
	 * Get the amount of time a specific player has bought the energy heal since the last season reset
	 * @param playerKeycloakId
	 */
	static async getAmountOfHealEnergyBoughtByPlayerThisWeek(playerKeycloakId: string): Promise<number> {
		const dateOfLastSeasonReset = await this.getDateOfLastSeasonReset();
		const logPlayer = await LogsDatabase.findOrCreatePlayer(playerKeycloakId);
		return LogsClassicalShopBuyouts.count({
			where: {
				playerId: logPlayer.id,
				shopItem: ShopItemType.ENERGY_HEAL,
				date: {
					[Op.gte]: dateOfLastSeasonReset
				}
			}
		});
	}

	private static async travelsOnPveIslandsCountThisWeekRequest(keycloakId: string): Promise<number> {
		return await LogsPlayersTravels.count({
			where: {
				"$LogsPlayer.keycloakId$": keycloakId,
				date: {
					[Op.gt]: Math.floor((getNextSundayMidnight() - hoursToMilliseconds(7 * 24)) / 1000)
				},
				"$LogsMapLink.start$": MapLocationDataController.instance.getWithAttributes([MapConstants.MAP_ATTRIBUTES.MAIN_CONTINENT])[0].id,
				"$LogsMapLink.end$": {
					[Op.in]: MapLocationDataController.instance.getWithAttributes([MapConstants.MAP_ATTRIBUTES.PVE_ISLAND_ENTRY])
						.map((mapLocation) => mapLocation.id)
				}
			},
			include: [{
				model: LogsPlayers,
				association: new HasOne(LogsPlayersTravels, LogsPlayers, {sourceKey: "playerId", foreignKey: "id"})
			}, {
				model: LogsMapLinks,
				association: new HasOne(LogsPlayersTravels, LogsMapLinks, {sourceKey: "mapLinkId", foreignKey: "id"})
			}],
			col: "playerId"
		});
	}

	private static async joinGuildThisWeekRequest(keycloakId: string, guildId: number): Promise<boolean> {
		return await LogsGuildsJoins.count({
			where: {
				"$LogsPlayer.keycloakId$": keycloakId,
				"$LogsGuild.gameId$": guildId,
				date: {
					[Op.gt]: Math.floor((getNextSundayMidnight() - hoursToMilliseconds(7 * 24)) / 1000)
				}
			},
			include: [{
				model: LogsPlayers,
				association: new HasOne(LogsGuildsJoins, LogsPlayers, {sourceKey: "addedId", foreignKey: "id"})
			}, {
				model: LogsGuilds,
				association: new HasOne(LogsGuildsJoins, LogsGuilds, {sourceKey: "guildId", foreignKey: "id"})
			}],
			col: "addedId"
		}) !== 0;
	}

	/**
	 * Parse the fight results to a ranked fight result which allows knowing how many fights the player won,
	 * lost or draw from the list given in parameter
	 * Warning: this function does not check for a specific player, it just counts the fights
	 * @param fights
	 * @private
	 */
	private static parseFightListToRankedFightData(fights: LogsFightsResults[]): RankedFightResult {
		const ret = {
			won: 0,
			lost: 0,
			draw: 0
		};
		const fightersId = [];
		for (const fight of fights) {
			if (fightersId.length === 0) {
				fightersId.push(fight.fightInitiatorId);
				fightersId.push(fight.player2Id);
			}
			if (fight.winner === 0) {
				ret.draw++;
			}
			else if (fight.winner === 1 && fight.fightInitiatorId === fightersId[0] || fight.winner === 2 && fight.player2Id === fightersId[0]) {
				ret.won++;
			}
			else {
				ret.lost++;
			}
		}
		return ret;
	}
}