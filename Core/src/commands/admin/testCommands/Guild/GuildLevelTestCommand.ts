import Guild from "../../../../core/database/game/models/Guild";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";
import { GuildConstants } from "../../../../../../Lib/src/constants/GuildConstants";

export const commandInfo: ITestCommand = {
	name: "guildlevel",
	aliases: ["glvl"],
	commandFormat: "<level>",
	typeWaited: { level: TypeKey.INTEGER },
	description: "Définit le niveau de la guilde du joueur.",
	argSuggestions: { level: ["1", "5", "10", "25", "50", "75", "100"] }
};

/**
 * Set your guild's level to the given integer
 */
const guildLevelTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const guild = await Guild.findOne({ where: { id: player.guildId } });
	if (!guild) {
		throw new Error("Erreur glvl : vous n'êtes pas dans une guilde !");
	}
	const guildLvl = parseInt(args[0], 10);
	if (guildLvl <= 0 || guildLvl > GuildConstants.MAX_LEVEL) {
		throw new Error(`Erreur glvl : niveau de guilde invalide ! Fourchette de niveau compris entre 0 et ${GuildConstants.MAX_LEVEL}.`);
	}
	guild.level = guildLvl;
	await guild.save();
	return `Votre guilde est maintenant niveau ${args[0]} !`;
};

commandInfo.execute = guildLevelTestCommand;
