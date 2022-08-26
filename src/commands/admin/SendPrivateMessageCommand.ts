import {escapeUsername} from "../../core/utils/StringUtils";
import {DraftBotEmbed} from "../../core/messages/DraftBotEmbed";
import {ICommand} from "../ICommand";
import {SlashCommandBuilder} from "@discordjs/builders";
import {Constants} from "../../core/Constants";
import {CommandInteraction} from "discord.js";
import {Translations} from "../../core/Translations";
import {draftBotClient} from "../../core/bot";
import {replyErrorMessage} from "../../core/utils/ErrorUtils";

declare function getIdFromMention(variable: string): string;

/**
 * Allow an admin to change the prefix the bot use in a specific server
 * @param interaction
 * @param {("fr"|"en")} language - Language to use in the response
 */
async function executeCommand(interaction: CommandInteraction, language: string): Promise<void> {
	const userId = getIdFromMention(interaction.options.getString("user")).length < 17
		? interaction.options.getString("user")
		: getIdFromMention(interaction.options.getString("user"));
	const dmModule = Translations.getModule("commands.sendPrivateMessage", language);
	const messageToSend = interaction.options.getString("message") +
		dmModule.format("signature", {
			username: escapeUsername(interaction.user.username)
		});
	const user = draftBotClient.users.cache.get(userId);

	if (userId === undefined) {
		await replyErrorMessage(interaction, language, dmModule.get("descError"));
		return;
	}
	if (user === undefined) {
		await replyErrorMessage(interaction, language, dmModule.get("personNotExists"));
		return;
	}
	const embed = new DraftBotEmbed()
		.formatAuthor(dmModule.get("title"), user)
		.setDescription(messageToSend);
	// TODO trouver un moyen de passer une image dans une slash command
	// .setImage(interaction.attachments.size > 0 ? [...message.attachments.values()][0].url : "");
	try {
		await user.send({content: messageToSend});
		// sendMessageAttachments(message, user);
		return await interaction.reply({embeds: [embed]});
	}
	catch {
		await replyErrorMessage(interaction, language, dmModule.get("errorCannotSend"));
	}
}

export const commandInfo: ICommand = {
	slashCommandBuilder: new SlashCommandBuilder()
		.setName("dm")
		.setDescription("Sends a dm to a player (support only)")
		.addStringOption(option => option.setName("user")
			.setDescription("The user you want to send a dm")
			.setRequired(true))
		.addStringOption(option => option.setName("message")
			.setDescription("The message to send")
			.setRequired(true)) as SlashCommandBuilder,
	executeCommand,
	requirements: {
		userPermission: Constants.ROLES.USER.BOT_OWNER
	},
	mainGuildCommand: true
};