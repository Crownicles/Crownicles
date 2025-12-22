import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";
import { PlayerBadgesManager } from "../../../../core/database/game/models/PlayerBadges";

export const commandInfo: ITestCommand = {
	name: "clearbadges",
	description: "Supprime tous les badges du joueur testeur. Utile pour tester les mécaniques d'obtention de badges et repartir à zéro"
};

/**
 * Delete all badges of the player
 */
const clearBadgesTestCommand: ExecuteTestCommandLike = async player => {
	await PlayerBadgesManager.setBadges(player.id, []);
	return "Vous avez supprimé vos badges !";
};

commandInfo.execute = clearBadgesTestCommand;
