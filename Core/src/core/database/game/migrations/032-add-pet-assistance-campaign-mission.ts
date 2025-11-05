import { QueryInterface } from "sequelize";
import {
	addCampaignMissionList, removeCampaignMissionList
} from "../GameDatabaseUtils";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await addCampaignMissionList(context, [
		11, // sellItems (objective: 1) - position 11
		23, // commandFightHistory (objective: 1) - position 24 (23 + 1 insertion avant)
		26, // petCaress (objective: 1) - position 28 (26 + 2 insertions avant)
		26, // petAssistedFight (objective: 1) - position 29 (26 + 3)
		33, // sellItems (objective: 3) - position 37 (33 + 4)
		38, // meetTalvar (objective: 1) - position 43 (38 + 5)
		43, // fightMinTurns (objective: 20) - position 49 (43 + 6)
		48, // meetSirRowan (objective: 10) - position 55 (48 + 7)
		51, // reachLevel (objective: 60) - position 59 (51 + 8)
		54, // sellItems (objective: 5) - position 63 (54 + 9)
		54, // fightMinTurns (objective: 26) - position 64 (54 + 10)
		67, // reachLevel (objective: 80) - position 78 (67 + 11)
		71, // fightMinTurns (objective: 30) - position 83 (71 + 12)
		72, // guildLevel (objective: 60) - position 85 (72 + 13)
		77, // showPetsToTalvar (objective: 10) - position 91 (77 + 14)
		77, // buyItemFromAlderic (objective: 1) - position 92 (77 + 15)
		77, // sellItemWithGivenCost (objective: 1500) - position 93 (77 + 16)
		77, // fightHealthPercent (objective: 5) - position 94 (77 + 17)
		77, // reachLevel (objective: 100) - position 95 (77 + 18)
		77 // exploreDifferentPlaces (objective: 20) - position 96 (77 + 19)
	]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMissionList(context, [
		11,
		23,
		26,
		26,
		33,
		38,
		43,
		48,
		51,
		54,
		54,
		67,
		71,
		72,
		77,
		77,
		77,
		77,
		77,
		77
	]);
}
