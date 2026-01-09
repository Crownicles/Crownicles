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
	ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";
import {
	StringConstants, SexTypeShort
} from "../../../../Lib/src/constants/StringConstants";

/**
 * Get the sex context string for i18n translations (male/female)
 */
function getSexContext(sex: SexTypeShort): string {
	return sex === StringConstants.SEX.MALE.short ? StringConstants.SEX.MALE.long : StringConstants.SEX.FEMALE.long;
}

/**
 * Generate a dynamic RP text for expedition status based on multiple factors
 */
function generateExpeditionRPText(
	expedition: NonNullable<CommandPetPacketRes["expeditionInProgress"]>,
	pet: CommandPetPacketRes["pet"],
	lng: Language
): string {
	const sexContext = getSexContext(pet.sex as SexTypeShort);

	// Get location info
	const locationEmoji = CrowniclesIcons.expedition.locations[expedition.locationType as ExpeditionLocationType];
	const locationName = expedition.mapLocationId
		? i18n.t(`commands:petExpedition.mapLocationExpeditions.${expedition.mapLocationId}`, { lng })
		: i18n.t("commands:petExpedition.mapLocationExpeditions.1", { lng });

	// Header with location and return time
	let text = i18n.t("commands:petExpedition.expeditionStatusRP.header", {
		lng,
		location: `${locationEmoji} ${locationName}`,
		returnTime: finishInTimeDisplay(new Date(expedition.endTime))
	});

	// Calculate expedition progress
	const totalDuration = expedition.endTime - expedition.startTime;
	const elapsed = Date.now() - expedition.startTime;
	const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

	// Determine progress stage
	let progressKey: string;
	if (progressPercent < 15) {
		progressKey = "justStarted";
	}
	else if (progressPercent > 85) {
		progressKey = "almostDone";
	}
	else {
		progressKey = "ongoing";
	}

	text += `\n${i18n.t(`commands:petExpedition.expeditionStatusRP.progress.${progressKey}`, {
		lng,
		context: sexContext
	})}`;

	// Determine situation based on pet force vs risk/difficulty
	const isStrongPet = pet.force >= 70; // Force on a scale of 0-100
	const isHighRisk = expedition.riskRate > 50 || expedition.difficulty > 60;

	let situationKey: string;
	if (isStrongPet && !isHighRisk) {
		situationKey = "strongPetEasyRisk";
	}
	else if (isStrongPet && isHighRisk) {
		situationKey = "strongPetHardRisk";
	}
	else if (!isStrongPet && !isHighRisk) {
		situationKey = "weakPetEasyRisk";
	}
	else {
		situationKey = "weakPetHardRisk";
	}

	text += `\n${i18n.t(`commands:petExpedition.expeditionStatusRP.situation.${situationKey}`, {
		lng,
		context: sexContext
	})}`;

	// Add food status if relevant
	const hasFood = expedition.foodConsumed > 0;
	const foodKey = hasFood ? "wellFed" : "noFood";

	text += `\n${i18n.t(`commands:petExpedition.expeditionStatusRP.food.${foodKey}`, {
		lng,
		context: sexContext
	})}`;

	return text;
}

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
 * Create the expedition button component - always shows "Expedition"
 * The specific UI (choice, in progress, or finished) is shown after clicking
 * @param lng
 */
function createExpeditionButton(lng: Language): ButtonBuilder {
	return new ButtonBuilder()
		.setCustomId("pet_expedition")
		.setStyle(ButtonStyle.Primary)
		.setLabel(i18n.t("commands:pet.expeditionButton", { lng }))
		.setEmoji(CrowniclesIcons.expedition.map);
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
		description += `\n\n${generateExpeditionRPText(packet.expeditionInProgress, packet.pet, lng)}`;
	}
	// Add tired pet warning if pet is tired and no expedition in progress
	else if (packet.isPetTired) {
		const sexContext = getSexContext(packet.pet.sex as SexTypeShort);
		description += i18n.t(`commands:pet.tiredPetWarning.${sexContext}`, { lng });
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
 */
function setupPetButtonCollector(params: {
	message: Message;
	packet: CommandPetPacketRes;
	interaction: CrowniclesInteraction;
	buttons: {
		petButton: ButtonBuilder; expeditionButton?: ButtonBuilder;
	};
	row: ActionRowBuilder<ButtonBuilder>;
	context: PacketContext;
}): void {
	const {
		message, packet, interaction, buttons, row, context
	} = params;
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
			/*
			 * Send expedition request packet - the handler will display the appropriate expedition UI
			 * (choice menu, in progress menu, or resolve menu based on state)
			 */
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

/**
 * Result of building pet command buttons
 */
interface PetButtonsResult {
	row: ActionRowBuilder<ButtonBuilder>;
	buttons: {
		petButton: ButtonBuilder; expeditionButton?: ButtonBuilder;
	};
}

/**
 * Build the buttons row for the pet command
 */
function buildPetButtons(
	lng: Language,
	hasExpedition: boolean,
	isOwnerViewingOwnPet: boolean
): PetButtonsResult {
	const petButton = createPetButton(lng, hasExpedition);
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(petButton);
	const buttons: {
		petButton: ButtonBuilder; expeditionButton?: ButtonBuilder;
	} = { petButton };

	if (isOwnerViewingOwnPet) {
		const expeditionButton = createExpeditionButton(lng);
		row.addComponents(expeditionButton);
		buttons.expeditionButton = expeditionButton;
	}

	return {
		row, buttons
	};
}

/**
 * Determine if button collector should be set up
 */
function shouldSetupCollector(packet: CommandPetPacketRes, isOwnerViewingOwnPet: boolean): boolean {
	return Boolean(packet.pet && isOwnerViewingOwnPet);
}

export async function handleCommandPetPacketRes(packet: CommandPetPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;
	const isOwnerViewingOwnPet = !packet.askedKeycloakId || packet.askedKeycloakId === context.keycloakId;
	const hasExpedition = Boolean(packet.expeditionInProgress);

	const {
		row, buttons
	} = buildPetButtons(lng, hasExpedition, isOwnerViewingOwnPet);
	const embed = await createPetEmbed(packet, interaction);
	const showButtons = shouldSetupCollector(packet, isOwnerViewingOwnPet);

	const reply = await interaction.reply({
		embeds: [embed],
		components: showButtons ? [row] : [],
		withResponse: true
	});

	if (!reply?.resource?.message) {
		return;
	}

	if (showButtons) {
		setupPetButtonCollector({
			message: reply.resource.message,
			packet,
			interaction,
			buttons,
			row,
			context
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
