import { SlashCommandBuilder } from "@discordjs/builders";
import { ApplicationCommandPermissions } from "discord.js";
import { KeycloakUser } from "../../../Lib/src/keycloak/KeycloakUser";
import { CrowniclesPacket } from "../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../messages/CrowniclesInteraction";

/**
 * The interface a classical command MUST take to be able to be executed
 */
export interface ICommand {
	slashCommandBuilder: SlashCommandBuilder;

	getPacket: (interaction: CrowniclesInteraction, user: KeycloakUser) => CrowniclesPacket | Promise<CrowniclesPacket> | Promise<null> | null;

	mainGuildCommand: boolean;
	slashCommandPermissions?: ApplicationCommandPermissions[];
}
