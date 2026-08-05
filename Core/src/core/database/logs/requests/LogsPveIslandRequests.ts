import {
	col, fn, Op
} from "sequelize";
import { MapCache } from "../../../maps/MapCache";
import { LogsPlayersTravels } from "../models/LogsPlayersTravels";

type LastIslandTravel = {
	playerId: number;
	lastDate: number;
};

export type LeaveIslandTravel = {
	playerId: number;
	leaveDate: number;
};

/**
 * Get the date at which each of the given log players left the pve island, for those who left it since their last travel on it
 */
export async function getPveIslandLeaveDates(logsPlayerIds: number[]): Promise<LeaveIslandTravel[]> {
	if (MapCache.logsPveIslandMapLinks.length === 0) {
		return [];
	}

	// Last time each player travelled on the island
	const lastIslandTravels = await LogsPlayersTravels.findAll({
		attributes: [
			"playerId",
			[fn("MAX", col("date")), "lastDate"]
		],
		where: {
			playerId: { [Op.in]: logsPlayerIds },
			mapLinkId: { [Op.in]: MapCache.logsPveIslandMapLinks }
		},
		group: ["playerId"],
		raw: true
	}) as unknown as LastIslandTravel[]; // Sequelize cannot type the shape of an aggregated raw query

	if (lastIslandTravels.length === 0) {
		return [];
	}

	// The first travel outside the island following the last travel on it is when the player left it
	return await LogsPlayersTravels.findAll({
		attributes: [
			"playerId",
			[fn("MIN", col("date")), "leaveDate"]
		],
		where: {
			mapLinkId: { [Op.notIn]: MapCache.logsPveIslandMapLinks },
			[Op.or]: lastIslandTravels.map(travel => ({
				playerId: travel.playerId,
				date: { [Op.gt]: travel.lastDate }
			}))
		},
		group: ["playerId"],
		raw: true
	}) as unknown as LeaveIslandTravel[]; // Sequelize cannot type the shape of an aggregated raw query
}
