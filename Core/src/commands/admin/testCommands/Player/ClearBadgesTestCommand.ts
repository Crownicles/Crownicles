import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "clearbadges",
	description: "Supprime tous les badges du joueur testeur. Utile pour tester les mécaniques d'obtention de badges et repartir à zéro"
};

/**
 * Delete all badges of the player
 */
const clearBadgesTestCommand: ExecuteTestCommandLike = async player => {
	player.badges = null;
	await player.save();
	return "Vous avez supprimé vos badges !";
};

commandInfo.execute = clearBadgesTestCommand;
