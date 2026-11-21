import { SmallEventDataController } from "../../data/SmallEvent";
import { FightActionDataController } from "../../data/FightAction";
import { FightAlterationDataController } from "../../data/FightAlteration";
import { PetAssistanceDataController } from "../../data/PetAssistance";
import { WitchActionDataController } from "../../data/WitchAction";
import { FightPetActionDataController } from "../../data/FightPetAction";
import { MissionsController } from "../missions/MissionsController";

/**
 * Import the modules of the game discovered from their files. The fights, the small events and the missions read them
 * synchronously, so they are imported once when the bot starts, after the packet handlers and their commands
 */
export async function loadDiscoveredModules(): Promise<void> {
	await SmallEventDataController.loadSmallEventsFunctions();
	await FightActionDataController.loadFightActionsFunctions();
	await FightAlterationDataController.loadFightAlterationsFunctions();
	await PetAssistanceDataController.loadPetAssistancesFunctions();
	await WitchActionDataController.loadWitchActionsFunctions();
	await FightPetActionDataController.loadFightPetActionsFunctions();
	await MissionsController.loadMissionInterfaces();
}
