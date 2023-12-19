import {ExecuteTestCommandLike, ITestCommand, TypeKey} from "../../../../core/CommandsTest";
import {draftBotInstance} from "../../../../index";

export const commandInfo: ITestCommand = {
	name: "playerlevel",
	aliases: ["level", "lvl"],
	commandFormat: "<niveau>",
	typeWaited: {
		niveau: TypeKey.INTEGER
	},
	description: "Mets votre joueur au niveau donné"
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
	draftBotInstance.logsDatabase.logLevelChange(player.discordUserId, player.level).then();
	await player.save();

	return `Vous êtes maintenant niveau ${player.level} !`;
};

commandInfo.execute = playerLevelTestCommand;