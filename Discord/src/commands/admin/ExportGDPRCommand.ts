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
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { PacketUtils } from "../../utils/PacketUtils";
import CommandRequirementHandlers from "../../packetHandlers/handlers/CommandRequirementHandlers";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { RequirementRightPacket } from "../../../../Lib/src/packets/commands/requirements/RequirementRightPacket";
import {
	CommandExportGDPRReq,
	CommandExportGDPRRes
} from "../../../../Lib/src/packets/commands/CommandExportGDPRPacket";
import { DiscordCache } from "../../bot/DiscordCache";

/**
 * Handle GDPR export response packet
 * Called by the packet handler when Core responds to the export request
 */
export async function handleCommandExportGDPRRes(
	context: PacketContext,
	packet: CommandExportGDPRRes
): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;

	if (!packet.started) {
		await interaction.editReply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("commands:exportgdpr.error", {
						lng,
						error: packet.error ?? "Unknown error"
					})
				)
			]
		});
		return;
	}

	// Export started successfully - inform the user that they will receive a DM
	await interaction.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:exportgdpr.title", { lng }), interaction.user)
				.setDescription(i18n.t("commands:exportgdpr.started", { lng }))
		]
	});
}

/**
 * Handle the GDPR export slash command
 * Validates the target user exists in Keycloak and sends export request to Core
 * @param interaction The Discord interaction
 * @param keycloakUser The authenticated Keycloak user (admin)
 * @returns The export request packet or null if validation fails
 */
async function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<CommandExportGDPRReq | null> {
	const lng = interaction.userLanguage;
	const context = await PacketUtils.createPacketContext(interaction, keycloakUser);

	// Check if the user has admin rights
	if (!context.rightGroups?.includes(RightGroup.ADMIN)) {
		await CommandRequirementHandlers.requirementRight(context, makePacket(RequirementRightPacket, {}));
		return null;
	}

	// Get the target Discord ID from the command options
	const targetDiscordId = interaction.options.getString("discordid", true);

	// Defer reply early to avoid timeout on long Keycloak lookups
	await interaction.deferReply({ ephemeral: true });

	// Look up the target user in Keycloak
	const targetUser = await KeycloakUtils.getDiscordUser(keycloakConfig, targetDiscordId, null);
	if (targetUser.isError || !targetUser.payload.user) {
		await interaction.editReply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("commands:exportgdpr.userNotFound", { lng })
				)
			]
		});
		return null;
	}

	// Return the packet - response will be handled by ExportGDPRCommandPacketHandlers
	return makePacket(CommandExportGDPRReq, {
		keycloakId: targetUser.payload.user.id,
		requesterKeycloakId: keycloakUser.id
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("exportgdpr")
		.addStringOption(option =>
			SlashCommandBuilderGenerator.generateOption("exportgdpr", "discordid", option)
				.setRequired(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: true
};
