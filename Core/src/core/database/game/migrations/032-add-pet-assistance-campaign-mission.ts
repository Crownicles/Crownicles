import { QueryInterface } from "sequelize";
import {
	addCampaignMissionList, removeCampaignMissionList
} from "../GameDatabaseUtils";

export async function up({ context }: { context: QueryInterface }): Promise<void> {
	await addCampaignMissionList(context, [
		10, // sellItems (objective: 1)
		23, // commandFightHistory (objective: 1)
		27, // petCaress (objective: 1)
		28, // petAssistedFight (objective: 1)
		36, // sellItems (objective: 3)
		42, // meetTalvar (objective: 1)
		48, // fightMinTurns (objective: 20)
		54, // meetSirRowan (objective: 10)
		58, // reachLevel (objective: 60)
		62, // sellItems (objective: 5)
		63, // fightMinTurns (objective: 26)
		77, // reachLevel (objective: 80)
		82, // fightMinTurns (objective: 30)
		84, // guildLevel (objective: 60)
		90, // showPetsToTalvar (objective: 10)
		91, // buyItemFromAlderic (objective: 1)
		92, // sellItemWithGivenCost (objective: 1)
		93, // fightHealthPercent (objective: 1)
		94, // reachLevel (objective: 100)
		95 // exploreDifferentPlaces (objective: 20)
	]);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
	await removeCampaignMissionList(context, [
		10,
		23,
		27,
		28,
		36,
		42,
		48,
		54,
		58,
		62,
		63,
		77,
		82,
		84,
		90,
		91,
		92,
		93,
		94,
		95
	]);
}
