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
import { CommandPetExpeditionPacketReq } from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
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
import { finishInTimeDisplay } from "../../../../Lib/src/utils/TimeUtils";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";

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
 * @param disabled - whether the button should be disabled (e.g., during expedition)
 */
function createPetButton(lng: Language, disabled = false): ButtonBuilder {
	return new ButtonBuilder()
		.setCustomId("pet_the_pet")
		.setLabel(i18n.t("commands:pet.petButton", { lng }))
		.setEmoji(CrowniclesIcons.petCommand.petButton)
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(disabled);
}

/**
 * Create the expedition button component
 * @param lng
 * @param hasExpedition - whether an expedition is in progress
 * @param expeditionFinished - whether the expedition has finished (time passed)
 */
function createExpeditionButton(lng: Language, hasExpedition: boolean, expeditionFinished: boolean): ButtonBuilder {
	const button = new ButtonBuilder()
		.setCustomId("pet_expedition");

	if (hasExpedition) {
		if (expeditionFinished) {
			// Expedition is done - show finish button (green/primary)
			button.setStyle(ButtonStyle.Success);
			button.setLabel(i18n.t("commands:pet.finishExpeditionButton", { lng }));
			button.setEmoji(CrowniclesIcons.expedition.map);
		}
		else {
			// Expedition still in progress - show recall button (red/danger)
			button.setStyle(ButtonStyle.Danger);
			button.setLabel(i18n.t("commands:pet.recallButton", { lng }));
			button.setEmoji(CrowniclesIcons.expedition.recall);
		}
	}
	else {
		button.setStyle(ButtonStyle.Primary);
		button.setLabel(i18n.t("commands:pet.expeditionButton", { lng }));
		button.setEmoji(CrowniclesIcons.expedition.map);
	}

	return button;
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

	let description = DisplayUtils.getOwnedPetFieldDisplay(packet.pet, lng);

	// Add expedition status if in progress
	if (packet.expeditionInProgress) {
		const locationEmoji = ExpeditionConstants.getLocationEmoji(packet.expeditionInProgress.locationType as ExpeditionLocationType);
		const locationName = i18n.t(`commands:petExpedition.locations.${packet.expeditionInProgress.locationType}`, { lng });
		const riskCategoryKey = ExpeditionConstants.getRiskCategoryName(packet.expeditionInProgress.riskRate);
		const riskCategory = i18n.t(`commands:petExpedition.riskCategories.${riskCategoryKey}`, { lng });

		description += `\n\n${i18n.t("commands:petExpedition.expeditionStatus", {
			lng,
			location: `${locationEmoji} ${locationName}`,
			risk: riskCategory,
			returnTime: finishInTimeDisplay(new Date(packet.expeditionInProgress.endTime))
		})}`;
	}

	return new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:pet.embedTitle", {
				lng,
				pseudo: escapeUsername(foundPlayerUsername ?? interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(description);
}

/**
 * Create and set up the button collector for the pet command
 * @param message
 * @param packet
 * @param interaction
 * @param buttons
 * @param row
 * @param context
 */
function setupPetButtonCollector(
	message: Message,
	packet: CommandPetPacketRes,
	interaction: CrowniclesInteraction,
	buttons: {
		petButton: ButtonBuilder; expeditionButton?: ButtonBuilder;
	},
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
			return i.customId === "pet_the_pet" || i.customId === "pet_expedition";
		},
		time: Constants.MESSAGES.COLLECTOR_TIME,
		max: 1
	});

	collector.on("collect", async (i: ButtonInteraction) => {
		if (i.customId === "pet_the_pet") {
			PacketUtils.sendPacketToBackend(context, makePacket(CommandPetCaressPacketReq, {}));

			await i.reply({
				content: StringUtils.getRandomTranslation("commands:pet.petPhrases", lng, {
					petName: packet.pet?.nickname || i18n.t("commands:pet.defaultPetName", { lng })
				})
			});
		}
		else if (i.customId === "pet_expedition") {
			// Send expedition request packet - the handler will display the expedition UI
			PacketUtils.sendPacketToBackend(context, makePacket(CommandPetExpeditionPacketReq, {}));
			await i.deferUpdate();
		}
	});

	collector.on("end", async () => {
		buttons.petButton.setDisabled(true);
		if (buttons.expeditionButton) {
			buttons.expeditionButton.setDisabled(true);
		}
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
	const hasExpedition = Boolean(packet.expeditionInProgress);
	const expeditionFinished = hasExpedition && Date.now() >= packet.expeditionInProgress!.endTime;

	// Disable pet button during expedition (can't caress a pet that's not here)
	const petButton = createPetButton(lng, hasExpedition);
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(petButton);
	const buttons: {
		petButton: ButtonBuilder; expeditionButton?: ButtonBuilder;
	} = { petButton };

	// Add expedition button if viewing own pet
	if (isOwnerViewingOwnPet) {
		const expeditionButton = createExpeditionButton(lng, hasExpedition, expeditionFinished);
		row.addComponents(expeditionButton);
		buttons.expeditionButton = expeditionButton;
	}

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
		setupPetButtonCollector(message, packet, interaction, buttons, row, context);
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
