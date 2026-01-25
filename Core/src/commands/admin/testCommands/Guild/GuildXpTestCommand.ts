import Guild from "../../../../core/database/game/models/Guild";
import { NumberChangeReason } from "../../../../../../Lib/src/constants/LogsConstants";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "guildxp",
	aliases: ["gxp"],
	commandFormat: "<experience>",
	typeWaited: {
		experience: TypeKey.INTEGER
	},
	description: "Définit l'expérience de la guilde du joueur testeur."
};

/**
 * Set your guild's experience to the given integer
 */
const guildXpTestCommand: ExecuteTestCommandLike = async (player, args, response) => {
	const guild = await Guild.findOne({ where: { id: player.guildId } });
	if (!guild) {
		throw new Error("Erreur gxp : vous n'êtes pas dans une guilde !");
	}
	const xp = parseInt(args[0], 10);
	if (xp < 0) {
		throw new Error("Erreur gxp : expérience de guilde invalide. Interdit de mettre de l'expérience négative !");
	}
	if (xp > 3 * guild.getExperienceNeededToLevelUp()) {
		throw new Error(`Erreur gxp : expérience donnée trop élevée : montant autorisé entre 0 et ${3 * guild.getExperienceNeededToLevelUp()}`);
	}
	if (guild.isAtMaxLevel()) {
		throw new Error("Erreur gxp : la guilde est déjà niveau max !");
	}
	await guild.addExperience({
		amount: xp, response, reason: NumberChangeReason.TEST
	});
	await guild.save();
	return `Votre guilde a maintenant ${args[0]} :star: !`;
};

commandInfo.execute = guildXpTestCommand;
