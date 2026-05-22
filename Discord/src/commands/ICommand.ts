import { SlashCommandBuilder } from "@discordjs/builders";
import {
	ApplicationCommandPermissions, AutocompleteInteraction
} from "discord.js";
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

	/**
	 * Whether the command is allowed in DMs (default: false).
	 * When true, the slash command is registered with both Guild and BotDM
	 * contexts, and the CommandsManager will execute it in DM channels
	 * without performing the per-channel guild permission checks.
	 */
	allowedInDM?: boolean;

	/**
	 * Optional handler for autocomplete interactions
	 */
	handleAutocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}
