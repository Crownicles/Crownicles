import Guild from "../../../../core/database/game/models/Guild";
import {
	ExecuteTestCommandLike, ITestCommand
} from "../../../../core/CommandsTest";

export const commandInfo: ITestCommand = {
	name: "guildid",
	aliases: ["gid", "mygid"],
	description: "Affiche l'ID de la guilde du joueur testeur ainsi que des informations de debug sur la guilde (nom, niveau, membres). Utile pour les commandes nécessitant un ID de guilde"
};

/**
 * Get your guild's id
 */
const guildIdTestCommand: ExecuteTestCommandLike = async player => {
	const guild = await Guild.findOne({ where: { id: player.guildId } });
	if (!guild) {
		throw new Error("Erreur mygid : vous n'êtes pas dans une guilde !");
	}
	return `Votre guilde (${guild.name}) possède l'id n°${guild.id} !`;
};

commandInfo.execute = guildIdTestCommand;
