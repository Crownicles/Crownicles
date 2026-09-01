import { SlashCommandBuilder } from "@discordjs/builders";
import { ChannelType } from "discord.js";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTournamentResumePacketReq } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	createTournamentContext, hasMinimumGuildSize, hasTournamentChannelPermissions,
	isBotOwner, isTournamentParentChannel, replyTournamentError, sendTournamentPacket
} from "./TournamentCommandUtils";

async function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<null> {
	if (!isBotOwner(interaction)) {
		return await replyTournamentError(interaction, "ownerOnly");
	}
	if (!interaction.guild) {
		return await replyTournamentError(interaction, "guildOnly");
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
	const tournamentId = interaction.options.getInteger("tournament-id", true);
	await interaction.deferReply();
	sendTournamentPacket(await createTournamentContext(interaction, user), makePacket(CommandTournamentResumePacketReq, {
		tournamentId
	}));
	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("tournament-resume")
		.addIntegerOption(option => SlashCommandBuilderGenerator.generateOption("tournament-resume", "tournament-id", option).setRequired(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
