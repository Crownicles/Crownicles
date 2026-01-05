import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { ICommand } from "../ICommand";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import { SlashCommandBuilder } from "@discordjs/builders";
import { KeycloakUtils } from "../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../bot/CrowniclesShard";
import { RightGroup } from "../../../../Lib/src/types/RightGroup";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import i18n from "../../translations/i18n";
import { generateDeletionCode } from "../../utils/AccountDeletionUtils";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { PacketUtils } from "../../utils/PacketUtils";
import CommandRequirementHandlers from "../../packetHandlers/handlers/CommandRequirementHandlers";
import {
	makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { RequirementRightPacket } from "../../../../Lib/src/packets/commands/requirements/RequirementRightPacket";

/**
 * Admin command to generate a deletion code for a user
 * The admin can then send this code to the user via email
 * The user must DM the bot with "DELETE ACCOUNT <code>" to start the deletion process
 */
async function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<null> {
	const lng = interaction.userLanguage;
	const context = await PacketUtils.createPacketContext(interaction, keycloakUser);

	// Check if the user has admin rights (same pattern as GiveBadgeCommand)
	if (!context.rightGroups?.includes(RightGroup.ADMIN)) {
		await CommandRequirementHandlers.requirementRight(context, makePacket(RequirementRightPacket, {}));
		return null;
	}

	// Get the target Discord ID from the command options
	const targetDiscordId = interaction.options.getString("discordid", true);

	// Look up the target user in Keycloak
	const targetUser = await KeycloakUtils.getDiscordUser(keycloakConfig, targetDiscordId, null);
	if (targetUser.isError || !targetUser.payload.user) {
		await interaction.reply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("commands:deletecode.userNotFound", { lng })
				)
			],
			ephemeral: true
		});
		return null;
	}

	// Generate the deletion code from the keycloak ID
	const deletionCode = generateDeletionCode(targetUser.payload.user.id);

	// Send the code back to the admin (ephemeral for security)
	await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:deletecode.title", { lng }), interaction.user)
				.setDescription(i18n.t("commands:deletecode.success", {
					lng,
					discordId: targetDiscordId,
					keycloakId: targetUser.payload.user.id,
					code: deletionCode
				}))
		],
		ephemeral: true
	});
	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("deletecode")
		.addStringOption(option =>
			SlashCommandBuilderGenerator.generateOption("deletecode", "discordid", option)
				.setRequired(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: true
};
