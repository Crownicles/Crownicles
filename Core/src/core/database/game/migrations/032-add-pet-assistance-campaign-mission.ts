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
		61, // sellItems (objective: 5)
		62, // fightMinTurns (objective: 26)
		80, // fightMinTurns (objective: 30)
		87, // showPetsToTalvar (objective: 10)
		88 // buyItemFromAlderic (objective: 1)
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
		61,
		62,
		80,
		87,
		88
	]);
}
