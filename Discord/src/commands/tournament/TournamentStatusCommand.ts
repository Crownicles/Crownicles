import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageFlags } from "discord.js";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTournamentStatusPacketReq } from "../../../../Lib/src/packets/commands/CommandTournamentPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	createTournamentContext, sendTournamentPacket
} from "./TournamentCommandUtils";

async function getPacket(interaction: CrowniclesInteraction, user: KeycloakUser): Promise<null> {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	sendTournamentPacket(await createTournamentContext(interaction, user), makePacket(CommandTournamentStatusPacketReq, {}));
	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("tournament") as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
