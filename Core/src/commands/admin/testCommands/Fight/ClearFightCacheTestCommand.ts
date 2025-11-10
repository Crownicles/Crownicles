import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { clearFightsDefenderCooldowns } from "../../../player/FightCommand";

export const commandInfo: ITestCommand = {
	name: "clearFightCache",
	description: "Vide le cache des adversaires récemment attaqués en combat PvP. Permet de retester le matchmaking sans attendre le cooldown."
};

/**
 * Clear the fights defender cooldowns cache
 */
const clearFightCacheTestCommand: ExecuteTestCommandLike = () => {
	const clearedCount = clearFightsDefenderCooldowns();
	return `✅ Cache des adversaires vidé avec succès ! ${clearedCount} entrée(s) supprimée(s).`;
};

commandInfo.execute = clearFightCacheTestCommand;
