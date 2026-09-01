import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageFlags } from "discord.js";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTournamentCancelPacketReq } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	createTournamentContext, isGuildAdministrator, replyTournamentError, sendTournamentPacket
} from "./TournamentCommandUtils";

async function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<null> {
	if (!isGuildAdministrator(interaction)) {
		return await replyTournamentError(interaction, "administratorOnly");
	}
	const tournamentId = interaction.options.getInteger("tournament-id", true);
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	sendTournamentPacket(await createTournamentContext(interaction, user), makePacket(CommandTournamentCancelPacketReq, {
		tournamentId
	}));
	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("tournament-cancel")
		.addIntegerOption(option => SlashCommandBuilderGenerator.generateOption("tournament-cancel", "tournament-id", option).setRequired(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
