import { SlashCommandBuilder } from "@discordjs/builders";
import { ChannelType } from "discord.js";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTournamentCreatePacketReq } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	createTournamentContext, hasMinimumGuildSize, hasTournamentChannelPermissions,
	isGuildAdministrator, isTournamentParentChannel, replyTournamentError, sendTournamentPacket
} from "./TournamentCommandUtils";

async function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<null> {
	if (!interaction.guild) {
		return await replyTournamentError(interaction, "guildOnly");
	}
	if (!isGuildAdministrator(interaction)) {
		return await replyTournamentError(interaction, "administratorOnly");
	}
	if (!hasMinimumGuildSize(interaction)) {
		return await replyTournamentError(interaction, "guildTooSmall");
	}
	if (interaction.channel.type !== ChannelType.GuildText && interaction.channel.type !== ChannelType.GuildAnnouncement) {
		return await replyTournamentError(interaction, "invalidChannel");
	}
	if (!isTournamentParentChannel(interaction) || !hasTournamentChannelPermissions(interaction)) {
		return await replyTournamentError(interaction, "missingChannelPermissions");
	}
	const code = interaction.options.getString("code", true);
	const registrationDays = interaction.options.getInteger("registration-days", true);
	const combatDays = interaction.options.getInteger("combat-days", true);
	await interaction.deferReply();
	sendTournamentPacket(await createTournamentContext(interaction, user), makePacket(CommandTournamentCreatePacketReq, {
		code,
		registrationDays,
		combatDays
	}));
	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("tournament-create")
		.addStringOption(option => SlashCommandBuilderGenerator.generateOption("tournament-create", "code", option).setRequired(true))
		.addIntegerOption(option => SlashCommandBuilderGenerator.generateOption("tournament-create", "registration-days", option)
			.setMinValue(1)
			.setMaxValue(7)
			.setRequired(true))
		.addIntegerOption(option => SlashCommandBuilderGenerator.generateOption("tournament-create", "combat-days", option)
			.setMinValue(1)
			.setMaxValue(7)
			.setRequired(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
