import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandPetPacketReq, CommandPetPacketRes
} from "../../../../Lib/src/packets/commands/CommandPetPacket";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { DiscordCache } from "../../bot/DiscordCache";
import { KeycloakUser } from "../../../../Lib/src/keycloak/KeycloakUser";
import { PacketUtils } from "../../utils/PacketUtils";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { escapeUsername } from "../../utils/StringUtils";

/**
 * Display all the information about a Pet
 */
async function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<CommandPetPacketReq | null> {
	const askedPlayer = await PacketUtils.prepareAskedPlayer(interaction, keycloakUser);
	if (!askedPlayer) {
		return null;
	}
	return makePacket(CommandPetPacketReq, { askedPlayer });
}


export async function handleCommandPetPacketRes(packet: CommandPetPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;

	let foundPlayerUsername;
	if (packet.askedKeycloakId) {
		foundPlayerUsername = await DisplayUtils.getEscapedUsername(packet.askedKeycloakId, lng);
	}

	await interaction.reply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(
					i18n.t("commands:pet.embedTitle", {
						lng,
						pseudo: escapeUsername(foundPlayerUsername ?? interaction.user.displayName)
					}),
					interaction.user
				)
				.setDescription(
					DisplayUtils.getOwnedPetFieldDisplay(packet.pet, lng)
				)
		]
	});
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("pet")
		.addUserOption(option =>
			SlashCommandBuilderGenerator.generateOption("pet", "user", option)
				.setRequired(false))
		.addIntegerOption(option =>
			SlashCommandBuilderGenerator.generateOption("pet", "rank", option)
				.setRequired(false)) as SlashCommandBuilder,
	getPacket,
	mainGuildCommand: false
};
