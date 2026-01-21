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
import { AttachmentBuilder } from "discord.js";

// skipcq: JS-C1003 - archiver does not expose itself as an ES Module.

const archiver = require("archiver") as typeof import("archiver");

/**
 * Admin command to export all GDPR data for a player
 * Returns a ZIP file with CSV files containing anonymized personal data
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

	if (!exportPacket.exists) {
		await interaction.editReply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("commands:exportgdpr.playerNotFound", { lng })
				)
			]
		});
		return;
	}

	if (exportPacket.error) {
		await interaction.editReply({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("commands:exportgdpr.error", {
						lng, error: exportPacket.error
					})
				)
			]
		});
		return;
	}

	// Create ZIP file from CSV files
	const archive = archiver("zip", { zlib: { level: 9 } });
	const chunks: Buffer[] = [];

	// Collect data as it streams
	archive.on("data", (chunk: Buffer) => chunks.push(chunk));

	// Create promise that resolves when archiving is complete
	const archivePromise = new Promise<Buffer>((resolve, reject) => {
		archive.on("end", () => resolve(Buffer.concat(chunks)));
		archive.on("error", reject);
	});

	// Add each CSV file to the archive
	for (const [filename, content] of Object.entries(exportPacket.csvFiles)) {
		archive.append(content, { name: filename });
	}

	await archive.finalize();

	// Wait for archive to complete
	const zipBuffer = await archivePromise;
	const fileName = i18n.t("commands:exportgdpr.fileName", {
		lng,
		anonymizedId: exportPacket.anonymizedPlayerId
	});

	// Send the ZIP file
	const attachment = new AttachmentBuilder(zipBuffer, { name: fileName });

	await interaction.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:exportgdpr.title", { lng }), interaction.user)
				.setDescription(i18n.t("commands:exportgdpr.success", {
					lng,
					anonymizedId: exportPacket.anonymizedPlayerId,
					fileCount: Object.keys(exportPacket.csvFiles).length
				}))
		],
		files: [attachment]
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

	// Send request to Core for GDPR export
	await DiscordMQTT.asyncPacketSender.sendPacketAndHandleResponse(
		context,
		makePacket(CommandExportGDPRReq, { keycloakId: targetUser.payload.user.id }),
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
