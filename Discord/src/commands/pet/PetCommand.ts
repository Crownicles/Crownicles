import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import i18n from "../../translations/i18n";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandPetPacketReq, CommandPetPacketRes, CommandPetCaressPacketReq
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
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, Message
} from "discord.js";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { Language } from "../../../../Lib/src/Language";

/**
 * Display all the information about a Pet
 * @param interaction
 * @param keycloakUser
 */
async function getPacket(interaction: CrowniclesInteraction, keycloakUser: KeycloakUser): Promise<CommandPetPacketReq | null> {
	const askedPlayer = await PacketUtils.prepareAskedPlayer(interaction, keycloakUser);
	if (!askedPlayer) {
		return null;
	}
	return makePacket(CommandPetPacketReq, { askedPlayer });
}

/**
 * Create the pet button component
 * @param lng
 */
function createPetButton(lng: Language): ButtonBuilder {
	return new ButtonBuilder()
		.setCustomId("pet_the_pet")
		.setLabel(i18n.t("commands:pet.petButton", { lng }))
		.setEmoji(CrowniclesIcons.petCommand.petButton)
		.setStyle(ButtonStyle.Secondary);
}

/**
 * Create the embed for the pet command response
 * @param packet
 * @param interaction
 */
async function createPetEmbed(
	packet: CommandPetPacketRes,
	interaction: CrowniclesInteraction
): Promise<CrowniclesEmbed> {
	const lng = interaction.userLanguage;
	let foundPlayerUsername;
	if (packet.askedKeycloakId) {
		foundPlayerUsername = await DisplayUtils.getEscapedUsername(packet.askedKeycloakId, lng);
	}

	return new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:pet.embedTitle", {
				lng,
				pseudo: escapeUsername(foundPlayerUsername ?? interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(
			DisplayUtils.getOwnedPetFieldDisplay(packet.pet, lng)
		);
}

/**
 * Create and set up the button collector for the pet command
 * @param message
 * @param packet
 * @param interaction
 * @param petButton
 * @param row
 * @param context
 */
function setupPetButtonCollector(
	message: Message,
	packet: CommandPetPacketRes,
	interaction: CrowniclesInteraction,
	petButton: ButtonBuilder,
	row: ActionRowBuilder<ButtonBuilder>,
	context: PacketContext
): void {
	const lng = interaction.userLanguage;
	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.Button,
		filter: (i: ButtonInteraction) => {
			if (i.user.id !== interaction.user.id) {
				sendInteractionNotForYou(i.user, i, lng);
				return false;
			}
			return i.customId === "pet_the_pet";
		},
		time: Constants.MESSAGES.COLLECTOR_TIME,
		max: 1
	});

	collector.on("collect", async (i: ButtonInteraction) => {
		PacketUtils.sendPacketToBackend(context, makePacket(CommandPetCaressPacketReq, {}));

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

export async function handleCommandPetPacketRes(packet: CommandPetPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);

	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;
	const isOwnerViewingOwnPet = !packet.askedKeycloakId || packet.askedKeycloakId === context.keycloakId;

	const petButton = createPetButton(lng);
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(petButton);
	const embed = await createPetEmbed(packet, interaction);

	const reply = await interaction.reply({
		embeds: [embed],
		components: packet.pet && isOwnerViewingOwnPet ? [row] : [],
		withResponse: true
	});

	if (!reply?.resource?.message) {
		return;
	}

	const message = reply.resource.message;

	if (packet.pet && isOwnerViewingOwnPet) {
		setupPetButtonCollector(message, packet, interaction, petButton, row, context);
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
