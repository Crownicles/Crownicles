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
import {
	escapeUsername, StringUtils
} from "../../utils/StringUtils";
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType
} from "discord.js";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";

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

	const petButton = new ButtonBuilder()
		.setCustomId("pet_the_pet")
		.setLabel(i18n.t("commands:pet.petButton", { lng }))
		.setEmoji(CrowniclesIcons.petCommand.petButton)
		.setStyle(ButtonStyle.Secondary);

	const row = new ActionRowBuilder<ButtonBuilder>()
		.addComponents(petButton);

	// Only show the pet button if the pet belongs to the user executing the command
	const isOwnerViewingOwnPet = !packet.askedKeycloakId || packet.askedKeycloakId === context.keycloakId;

	const reply = await interaction.reply({
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
		],
		components: packet.pet && isOwnerViewingOwnPet ? [row] : [],
		withResponse: true
	});

	if (!reply?.resource?.message) {
		return;
	}
	const message = reply.resource.message;

	if (packet.pet && isOwnerViewingOwnPet) {
		const collector = message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: i => {
				if (i.user.id !== interaction.user.id) {
					sendInteractionNotForYou(i.user, i, interaction.userLanguage);
					return false;
				}
				return i.customId === "pet_the_pet";
			},
			time: Constants.MESSAGES.COLLECTOR_TIME,
			max: 1
		});

		collector.on("collect", async (i: ButtonInteraction) => {
			await i.reply({
				content: StringUtils.getRandomTranslation("commands:pet.petPhrases", lng, {
					petName: packet.pet?.nickname || i18n.t("commands:pet.defaultPetName", { lng })
				})
			});
		});

		collector.on("end", async () => {
			petButton.setDisabled(true);
			await message.edit({ components: [row] });
		});
	}
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
