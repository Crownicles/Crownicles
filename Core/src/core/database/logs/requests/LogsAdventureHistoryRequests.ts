import { QueryTypes } from "sequelize";
import { AdventureHistoryConstants } from "../../../../../../Lib/src/constants/AdventureHistoryConstants";
import {
	AdventureHistoryEvent, AdventureHistoryPage
} from "../../../../../../Lib/src/types/AdventureHistory";
import {
	asSeconds, getDateLogs
} from "../../../../../../Lib/src/utils/TimeUtils";
import { LogsPlayersPossibilities } from "../models/LogsPlayersPossibilities";
import { LogsPlayers } from "../models/LogsPlayers";

type AdventureHistoryRow = Omit<AdventureHistoryEvent, "mapId"> & { mapId: number | null };

export async function getAdventureHistory(playerKeycloakId: string, page = 0, until = asSeconds(getDateLogs() - 1)): Promise<AdventureHistoryPage> {
	if (!Number.isInteger(page) || page < 0 || page > AdventureHistoryConstants.MAX_PAGE) {
		throw new RangeError("Invalid adventure history page");
	}
	if (!Number.isInteger(until) || until < 0) {
		throw new RangeError("Invalid adventure history timestamp");
	}
	const upperBound = asSeconds(Math.min(until, getDateLogs() - 1));
	const player = await LogsPlayers.findOne({
		attributes: ["id"], where: { keycloakId: playerKeycloakId }
	});
	if (!player) {
		return {
			entries: [], until: upperBound
		};
	}

	// The event is logged after its outcome sends the player on, so the arrival is the last travel started strictly before it.
	const rows = await LogsPlayersPossibilities.sequelize!.query<AdventureHistoryRow>(`
		SELECT entry.date, possibility.bigEventId AS eventId,
			COALESCE(possibility.possibilityName, :expiredPossibility) AS possibilityId,
			CAST(possibility.issueIndex AS CHAR) AS outcomeId,
			(
				SELECT link.end FROM players_travels travel
				INNER JOIN map_links link ON link.id = travel.mapLinkId
				WHERE travel.playerId = entry.playerId AND travel.date < entry.date
				ORDER BY travel.date DESC LIMIT 1
			) AS mapId
		FROM players_possibilities entry
		INNER JOIN possibilities possibility ON possibility.id = entry.possibilityId
		WHERE entry.playerId = :playerId AND entry.date >= :since AND entry.date <= :until
		ORDER BY entry.date DESC, entry.possibilityId DESC
		LIMIT :limit OFFSET :offset
	`, {
		replacements: {
			playerId: player.id,
			expiredPossibility: "end",
			since: asSeconds(getDateLogs() - AdventureHistoryConstants.WINDOW_SECONDS),
			until: upperBound,
			limit: AdventureHistoryConstants.PAGE_SIZE + 1,
			offset: page * AdventureHistoryConstants.PAGE_SIZE
		},
		type: QueryTypes.SELECT
	});
	return {
		entries: rows.slice(0, AdventureHistoryConstants.PAGE_SIZE).map(({
			mapId, ...entry
		}) => ({
			...entry, ...mapId === null ? {} : { mapId }
		})),
		until: upperBound,
		...rows.length > AdventureHistoryConstants.PAGE_SIZE && page < AdventureHistoryConstants.MAX_PAGE ? { nextPage: page + 1 } : {}
	};
}
