import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { crowniclesInstance } from "../../../../index";

export const commandInfo: ITestCommand = {
	name: "playerlevel",
	aliases: ["level", "lvl"],
	commandFormat: "<niveau>",
	typeWaited: { niveau: TypeKey.INTEGER },
	description: "Définit le niveau du joueur testeur. Le niveau influence les points de vie, de puissance, et débloque de nouvelles fonctionnalités"
};

/**
 * Set the level of the player
 */
const playerLevelTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const lvl = parseInt(args[0], 10);
	if (lvl <= 0 || lvl > 1000) {
		throw new Error("Erreur level : niveau donné doit être compris entre 1 et 1000 !");
	}
	player.level = lvl;
	crowniclesInstance?.logsDatabase.logLevelChange(player.keycloakId, player.level).then();
	await player.save();

	return `Vous êtes maintenant niveau ${player.level} !`;
};

commandInfo.execute = playerLevelTestCommand;
