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
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { RequirementRightPacket } from "../../../../Lib/src/packets/commands/requirements/RequirementRightPacket";
import { DiscordMQTT } from "../../bot/DiscordMQTT";
import {
	CommandExportGDPRReq,
	CommandExportGDPRRes
} from "../../../../Lib/src/packets/commands/CommandExportGDPRPacket";

/**
 * Admin command to export all GDPR data for a player
 * The export runs in background and the result is sent as a DM to the admin
 */
async function handleExportResponse(
	interaction: CrowniclesInteraction,
	context: PacketContext,
	packetName: string,
	packet: CrowniclesPacket
): Promise<void> {
	if (packetName !== CommandExportGDPRRes.name) {
		return;
	}

	const lng = interaction.userLanguage;
	const exportPacket = packet as CommandExportGDPRRes;

	if (!exportPacket.started) {
		await interaction.editReply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("commands:exportgdpr.error", {
						lng,
						error: exportPacket.error ?? "Unknown error"
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

async function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<null> {
	const lng = interaction.userLanguage;
	const context = await PacketUtils.createPacketContext(interaction, keycloakUser);

	// Check if the user has admin rights
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
					i18n.t("commands:exportgdpr.userNotFound", { lng })
				)
			],
			ephemeral: true
		});
		return null;
	}

	await interaction.deferReply({ ephemeral: true });

	/*
	 * Send request to Core for GDPR export
	 * The result will be sent as a DM to the requesting admin (keycloakUser.id)
	 */
	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
		context,
		makePacket(CommandExportGDPRReq, {
			keycloakId: targetUser.payload.user.id,
			requesterKeycloakId: keycloakUser.id
		}),
		(responseContext, responsePacketName, responsePacket) =>
			handleExportResponse(interaction, responseContext, responsePacketName, responsePacket)
	);

	return null;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("exportgdpr")
		.addStringOption(option =>
			SlashCommandBuilderGenerator.generateOption("exportgdpr", "discordid", option)
				.setRequired(true)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: true
};
