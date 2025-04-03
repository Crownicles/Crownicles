import Guild from "../../../../core/database/game/models/Guild";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "advanceguilddaily",
	aliases: ["agd"],
	commandFormat: "<time>",
	typeWaited: {
		time: TypeKey.INTEGER
	},
	description: "Avance le gd de votre joueur d'une durée en minutes donnée"
};

/**
 * Quick travel your gd of a given time
 */
const advanceGuildDailyTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const guild = await Guild.findOne({ where: { id: player.guildId } });
	if (!guild) {
		throw new Error("Erreur agd : vous n'êtes pas dans une guilde !");
	}
	guild.lastDailyAt = new Date(guild.lastDailyAt.valueOf() - parseInt(args[0], 10) * 60000);
	await guild.save();
	return `Vous avez avancé votre gd de ${args[0]} minutes !`;
};

commandInfo.execute = advanceGuildDailyTestCommand;
