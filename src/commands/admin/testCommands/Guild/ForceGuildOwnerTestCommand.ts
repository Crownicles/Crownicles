import Guild from "../../../../core/database/game/models/Guild";
import {format} from "../../../../core/utils/StringFormatter";
import {draftBotInstance} from "../../../../core/bot";
import {CommandInteraction} from "discord.js";
import {ITestCommand} from "../../../../core/CommandsTest";
import {Players} from "../../../../core/database/game/models/Player";

export const commandInfo: ITestCommand = {
	name: "forceguildowner",
	aliases: ["fgo"],
	commandFormat: "",
	messageWhenExecuted: "Vous êtes maintenant chef de votre guilde (Guilde {gName}) !",
	description: "Vous passe chef de guilde de force",
	commandTestShouldReply: true,
	execute: null // Defined later
};

/**
 * Force you to be the guild's chief
 * @param {("fr"|"en")} language - Language to use in the response
 * @param interaction
 * @return {String} - The successful message formatted
 */
const forceGuildOwnerTestCommand = async (language: string, interaction: CommandInteraction): Promise<string> => {
	const [player] = await Players.getOrRegister(interaction.user.id);
	const guild = await Guild.findOne({where: {id: player.guildId}});
	if (guild === null) {
		throw new Error("Erreur forceguildowner : vous n'êtes pas dans une guilde !");
	}
	draftBotInstance.logsDatabase.logGuildChiefChange(guild, player.id).then();
	guild.chiefId = player.id;
	await guild.save();
	return format(commandInfo.messageWhenExecuted, {gName: guild.name});
};

commandInfo.execute = forceGuildOwnerTestCommand;