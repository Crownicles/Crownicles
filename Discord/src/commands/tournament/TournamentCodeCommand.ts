import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageFlags } from "discord.js";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTournamentGenerateCodePacketReq } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	isBotOwner, createTournamentContext, replyTournamentError, sendTournamentPacket
} from "./TournamentCommandUtils";

async function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<null> {
	if (!interaction.guild) {
		return await replyTournamentError(interaction, "guildOnly");
	}
	if (!isBotOwner(interaction)) {
		return await replyTournamentError(interaction, "ownerOnly");
	}
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	sendTournamentPacket(await createTournamentContext(interaction, user), makePacket(CommandTournamentGenerateCodePacketReq, {}));
	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("tournament-code") as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
