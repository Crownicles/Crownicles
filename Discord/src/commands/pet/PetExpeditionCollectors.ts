import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction,
	User
} from "discord.js";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { escapeUsername } from "../../utils/StringUtils";
import { Language } from "../../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { ReactionCollectorPetExpeditionPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetExpedition";
import {
	ReactionCollectorPetExpeditionChoicePacket,
	ExpeditionOptionData
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetExpeditionChoice";
import { ReactionCollectorPetExpeditionFinishedPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetExpeditionFinished";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import {
	DiscordCollectorUtils, disableRows
} from "../../utils/DiscordCollectorUtils";
import {
	buildInProgressDescription,
	getExpeditionLocationName,
	getSexContext,
	getTranslatedRiskCategoryName,
	buildExpeditionOptionText,
	getPetDisplayString,
	getRiskEmoji
} from "./expedition/ExpeditionDisplayUtils";

/**
 * Create a collector for the expedition in progress view with recall option
 */
export async function createPetExpeditionCollector(
	context: PacketContext,
	packet: ReactionCollectorPetExpeditionPacket
): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return null;
	}

	const data = packet.data.data;
	const lng = interaction.userLanguage;

	const locationEmoji = CrowniclesIcons.expedition.locations[data.locationType];
	const locationName = getExpeditionLocationName(lng, data.mapLocationId, data.isDistantExpedition);
	const petDisplay = getPetDisplayString(data.pet, lng);
	const sexContext = getSexContext(data.pet.petSex);

	const description = buildInProgressDescription({
		lng,
		petDisplay,
		locationEmoji,
		locationName,
		riskRate: data.riskRate,
		returnTime: new Date(data.returnTime),
		sexContext,
		foodConsumed: data.foodConsumed
	});

	const embed = new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:petExpedition.inProgressTitle", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(description);

	const row = new ActionRowBuilder<ButtonBuilder>();
	const recallButton = new ButtonBuilder()
		.setCustomId("expedition_recall")
		.setLabel(i18n.t("commands:petExpedition.recallButton", { lng }))
		.setEmoji(CrowniclesIcons.expedition.recall)
		.setStyle(ButtonStyle.Danger);
	row.addComponents(recallButton);

	const cancelButton = new ButtonBuilder()
		.setCustomId("expedition_cancel_view")
		.setLabel(i18n.t("commands:petExpedition.closeButton", { lng }))
		.setStyle(ButtonStyle.Secondary);
	row.addComponents(cancelButton);

	const msg = await interaction.channel.send({
		embeds: [embed],
		components: [row]
	});

	if (!msg) {
		return null;
	}

	const collector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		if (buttonInteraction.user.id !== interaction.user.id) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		if (buttonInteraction.customId === "expedition_recall") {
			// Recall - defer reply as Core will send a response
			await buttonInteraction.deferReply();
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, 0);
		}
		else if (buttonInteraction.customId === "expedition_cancel_view") {
			// Close - just acknowledge, no response expected from Core
			await buttonInteraction.deferUpdate();
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, null, 1);
		}

		collector.stop();
	});

	collector.on("end", async () => {
		disableRows([row]);
		await msg.edit({ components: [row] }).catch(() => null);
	});

	return [collector];
}

/**
 * Add expedition option to the select menu
 */
function addExpeditionMenuOption(
	selectMenu: StringSelectMenuBuilder,
	exp: ExpeditionOptionData,
	lng: Language
): void {
	const locationEmoji = CrowniclesIcons.expedition.locations[exp.locationType];
	const locationName = getExpeditionLocationName(lng, exp.mapLocationId, exp.isDistantExpedition);
	const displayDuration = i18n.formatDuration(exp.displayDurationMinutes, lng);

	selectMenu.addOptions({
		label: `${locationEmoji} ${locationName}`.substring(0, 100),
		description: `${displayDuration} - ${getTranslatedRiskCategoryName(exp.riskRate, lng)}`,
		value: exp.id
	});
}

/**
 * Build guild provisions description text
 */
function buildGuildProvisionsText(
	data: ReactionCollectorPetExpeditionChoicePacket["data"]["data"],
	lng: Language,
	petDisplay: string
): string {
	const sexContext = getSexContext(data.pet.petSex);
	const hasGuildProvisions = data.hasGuild && data.guildFoodAmount !== undefined;

	// Build provisions info text
	const provisionsText = hasGuildProvisions
		? i18n.t("commands:petExpedition.guildProvisionsInfo", {
			lng,
			amount: data.guildFoodAmount,
			foodCostDisplay: i18n.t("commands:petExpedition.foodCost", {
				lng,
				count: data.guildFoodAmount
			})
		})
		: i18n.t("commands:petExpedition.noGuildProvisionsInfo", { lng });

	// Build pet impatience text
	const impatienceText = i18n.t("commands:petExpedition.petImpatience", {
		lng,
		context: sexContext,
		petDisplay
	});

	return `\n\n${provisionsText}\n\n${impatienceText}`;
}

/**
 * Handle the collector interaction for expedition choice
 */
function handleExpeditionChoiceInteraction(
	componentInteraction: ButtonInteraction | StringSelectMenuInteraction,
	data: ReactionCollectorPetExpeditionChoicePacket["data"]["data"],
	packet: ReactionCollectorPetExpeditionChoicePacket,
	context: PacketContext
): void {
	if (componentInteraction.isStringSelectMenu()) {
		const chosenId = componentInteraction.values[0];
		const expeditionIndex = data.expeditions.findIndex((exp: ExpeditionOptionData) => exp.id === chosenId);
		if (expeditionIndex !== -1) {
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, componentInteraction, expeditionIndex);
		}
	}
	else if (componentInteraction.customId === "expedition_cancel") {
		DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, componentInteraction, data.expeditions.length);
	}
}

/**
 * Create a collector for the expedition choice menu
 */
export async function createPetExpeditionChoiceCollector(
	context: PacketContext,
	packet: ReactionCollectorPetExpeditionChoicePacket
): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return null;
	}

	const data = packet.data.data;
	const lng = interaction.userLanguage;
	const petDisplay = getPetDisplayString(data.pet, lng);

	// Build description with all expedition options
	let description = i18n.t("commands:petExpedition.chooseExpedition", {
		lng, petDisplay
	});
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("expedition_choice")
		.setPlaceholder(i18n.t("commands:petExpedition.selectPlaceholder", { lng }));

	for (let i = 0; i < data.expeditions.length; i++) {
		description += buildExpeditionOptionText(data.expeditions[i], i, lng);
		addExpeditionMenuOption(selectMenu, data.expeditions[i], lng);
	}
	description += buildGuildProvisionsText(data, lng, petDisplay);

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:petExpedition.chooseExpeditionTitle", {
			lng, pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(description);

	const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
	const cancelButton = new ButtonBuilder()
		.setCustomId("expedition_cancel")
		.setLabel(i18n.t("commands:petExpedition.cancelButton", { lng }))
		.setEmoji(CrowniclesIcons.expedition.recall)
		.setStyle(ButtonStyle.Danger);
	const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(cancelButton);

	const msg = await interaction.channel.send({
		embeds: [embed], components: [selectRow, buttonRow]
	});
	if (!msg) {
		return null;
	}

	const collector = msg.createMessageComponentCollector({ time: packet.endTime - Date.now() });

	collector.on("collect", async componentInteraction => {
		if (componentInteraction.user.id !== interaction.user.id) {
			await sendInteractionNotForYou(componentInteraction.user, componentInteraction, lng);
			return;
		}
		await componentInteraction.deferReply();
		handleExpeditionChoiceInteraction(componentInteraction as ButtonInteraction | StringSelectMenuInteraction, data, packet, context);
		collector.stop();
	});

	collector.on("end", async () => {
		selectMenu.setDisabled(true);
		cancelButton.setDisabled(true);
		await msg.edit({ components: [selectRow, buttonRow] }).catch(() => null);
	});

	return [collector];
}

/**
 * Build the embed for the finished expedition view
 */
function buildFinishedExpeditionEmbed(
	data: ReactionCollectorPetExpeditionFinishedPacket["data"]["data"],
	lng: Language,
	userName: string,
	user: User
): CrowniclesEmbed {
	const locationEmoji = CrowniclesIcons.expedition.locations[data.locationType];
	const locationName = getExpeditionLocationName(lng, data.mapLocationId, data.isDistantExpedition);
	const petDisplay = getPetDisplayString(data.pet, lng);
	const sexContext = getSexContext(data.pet.petSex);

	const intro = i18n.t("commands:petExpedition.finishedDescription.talisman.intro", {
		lng,
		petDisplay,
		location: `${locationEmoji} ${locationName}`
	});
	const risk = i18n.t("commands:petExpedition.finishedDescription.risk", {
		lng,
		risk: getTranslatedRiskCategoryName(data.riskRate, lng),
		riskEmoji: getRiskEmoji(data.riskRate)
	});
	const impatience = i18n.t("commands:petExpedition.finishedDescription.impatience", {
		lng,
		context: sexContext
	});

	return new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:petExpedition.finishedTitle", {
				lng,
				pseudo: escapeUsername(userName)
			}),
			user
		)
		.setDescription(`${intro}\n\n${risk}\n\n${impatience}`);
}

/**
 * Build the claim button row for finished expedition
 */
function buildClaimButtonRow(lng: Language): ActionRowBuilder<ButtonBuilder> {
	const row = new ActionRowBuilder<ButtonBuilder>();
	const claimButton = new ButtonBuilder()
		.setCustomId("expedition_claim")
		.setLabel(i18n.t("commands:petExpedition.claimButton", { lng }))
		.setEmoji(CrowniclesIcons.expedition.loot)
		.setStyle(ButtonStyle.Success);
	row.addComponents(claimButton);
	return row;
}

/**
 * Create a collector for the finished expedition view with claim option
 */
export async function createPetExpeditionFinishedCollector(
	context: PacketContext,
	packet: ReactionCollectorPetExpeditionFinishedPacket
): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return null;
	}

	const data = packet.data.data;
	const lng = interaction.userLanguage;

	const embed = buildFinishedExpeditionEmbed(data, lng, interaction.user.displayName, interaction.user);
	const row = buildClaimButtonRow(lng);

	const msg = await interaction.channel.send({
		embeds: [embed],
		components: [row]
	});

	if (!msg) {
		return null;
	}

	const collector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		if (buttonInteraction.user.id !== interaction.user.id) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		await buttonInteraction.deferReply();

		if (buttonInteraction.customId === "expedition_claim") {
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, 0);
		}

		collector.stop();
	});

	collector.on("end", async () => {
		disableRows([row]);
		await msg.edit({ components: [row] }).catch(() => null);
	});

	return [collector];
}
