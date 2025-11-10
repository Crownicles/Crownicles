import Guild from "../../../../core/database/game/models/Guild";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import { crowniclesInstance } from "../../../../index";

export const commandInfo: ITestCommand = {
	name: "guildpoints",
	aliases: [
		"gpoints",
		"guildscore",
		"gscore"
	],
	commandFormat: "<points>",
	typeWaited: { points: TypeKey.INTEGER },
	description: "Définit le score total de la guilde du joueur testeur."
};

/**
 * Set your guild's score to the given integer
 */
const guildScoreTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const guild = await Guild.findOne({ where: { id: player.guildId } });
	if (!guild) {
		throw new Error("Erreur gpoints : vous n'êtes pas dans une guilde !");
	}
	const guildScore = parseInt(args[0], 10);
	if (guildScore <= 0) {
		throw new Error("Erreur gpoints : score de guilde invalide ! Il doit être supérieur à 0 !");
	}
	guild.score = guildScore;
	crowniclesInstance.logsDatabase.logGuildPointsChange(guild, NumberChangeReason.TEST).then();
	await guild.save();
	return `Votre guilde a maintenant ${args[0]} points !`;
};

commandInfo.execute = guildScoreTestCommand;
