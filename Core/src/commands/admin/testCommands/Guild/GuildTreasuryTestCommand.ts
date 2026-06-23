import Guild from "../../../../core/database/game/models/Guild";
import {
	ExecuteTestCommandLike, ITestCommand, TypeKey
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "guildtreasury",
	aliases: [
		"gtreasury",
		"guildmoney",
		"gmoney"
	],
	commandFormat: "<treasury>",
	typeWaited: { treasury: TypeKey.INTEGER },
	description: "Définit la trésorerie de la guilde du joueur testeur à la valeur spécifiée. La trésorerie sert aux achats du domaine de guilde (nourriture, améliorations)."
};

/**
 * Set the treasury of the tester's guild to the given integer
 */
const guildTreasuryTestCommand: ExecuteTestCommandLike = async (player, args) => {
	const guild = await Guild.findOne({ where: { id: player.guildId } });
	if (!guild) {
		throw new Error("Erreur gmoney : vous n'êtes pas dans une guilde !");
	}
	const treasury = parseInt(args[0], 10);
	if (treasury < 0) {
		throw new Error("Erreur gmoney : trésorerie donnée inférieure à 0 interdite !");
	}
	guild.treasury = treasury;
	await guild.save();

	return `Votre guilde possède maintenant ${guild.treasury} :moneybag: dans sa trésorerie !`;
};

commandInfo.execute = guildTreasuryTestCommand;
