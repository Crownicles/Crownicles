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
	StringSelectMenuInteraction
} from "discord.js";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { escapeUsername } from "../../utils/StringUtils";
import {
	finishInTimeDisplay, minutesDisplay
} from "../../../../Lib/src/utils/TimeUtils";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { Language } from "../../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { DisplayUtils } from "../../utils/DisplayUtils";
import {
	SexTypeShort, StringConstants
} from "../../../../Lib/src/constants/StringConstants";
import { ReactionCollectorCreationPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorPetExpeditionData } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetExpedition";
import {
	ReactionCollectorPetExpeditionChoiceData,
	ExpeditionOptionData
} from "../../../../Lib/src/packets/interaction/ReactionCollectorPetExpeditionChoice";
import { ReactionCollectorPetExpeditionFinishedData } from "../../../../Lib/src/packets/interaction/ReactionCollectorPetExpeditionFinished";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import {
	DiscordCollectorUtils, disableRows
} from "../../utils/DiscordCollectorUtils";

/**
 * Get the sex context string for i18n translations (male/female)
 */
function getSexContext(sex: SexTypeShort): string {
	return sex === StringConstants.SEX.MALE.short ? StringConstants.SEX.MALE.long : StringConstants.SEX.FEMALE.long;
}

/**
 * Get translated risk category name for display
 */
function getTranslatedRiskCategoryName(riskRate: number, lng: Language): string {
	const categoryKey = ExpeditionConstants.getRiskCategoryName(riskRate);
	return i18n.t(`commands:petExpedition.riskCategories.${categoryKey}`, { lng });
}

/**
 * Get translated wealth category name for display
 */
function getTranslatedWealthCategoryName(wealthRate: number, lng: Language): string {
	const categoryKey = ExpeditionConstants.getWealthCategoryName(wealthRate);
	return i18n.t(`commands:petExpedition.wealthCategories.${categoryKey}`, { lng });
}

/**
 * Get translated difficulty category name for display
 */
function getTranslatedDifficultyCategoryName(difficulty: number, lng: Language): string {
	const categoryKey = ExpeditionConstants.getDifficultyCategoryName(difficulty);
	return i18n.t(`commands:petExpedition.difficultyCategories.${categoryKey}`, { lng });
}

/**
 * Get the display name for an expedition location
 * Uses the stylized expedition name based on mapLocationId
 */
function getExpeditionLocationName(
	lng: Language,
	mapLocationId: number,
	isDistantExpedition?: boolean
): string {
	const expeditionName = i18n.t(`commands:petExpedition.mapLocationExpeditions.${mapLocationId}`, { lng });
	if (isDistantExpedition) {
		return i18n.t("commands:petExpedition.distantExpeditionPrefix", {
			lng,
			location: expeditionName
		});
	}
	return expeditionName;
}

/**
 * Create a collector for the expedition in progress view with recall option
 */
export async function createPetExpeditionCollector(
	context: PacketContext,
	packet: ReactionCollectorCreationPacket
): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return null;
	}

	const data = packet.data.data as ReactionCollectorPetExpeditionData;
	const lng = interaction.userLanguage;

	const locationEmoji = ExpeditionConstants.getLocationEmoji(data.locationType);
	const locationName = getExpeditionLocationName(lng, data.mapLocationId, data.isDistantExpedition);
	const petDisplay = `${DisplayUtils.getPetIcon(data.petId, data.petSex)} **${DisplayUtils.getPetNicknameOrTypeName(data.petNickname ?? null, data.petId, data.petSex, lng)}**`;
	const sexContext = getSexContext(data.petSex);

	// Build food info string if food was consumed
	const foodInfo = data.foodConsumed && data.foodConsumed > 0
		? i18n.t("commands:petExpedition.inProgressFoodInfo", {
			lng,
			amount: data.foodConsumed
		})
		: "";

	const embed = new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:petExpedition.inProgressTitle", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(
			i18n.t("commands:petExpedition.inProgressDescription", {
				lng,
				context: sexContext,
				petDisplay,
				location: `${locationEmoji} ${locationName}`,
				risk: getTranslatedRiskCategoryName(data.riskRate, lng),
				returnTime: finishInTimeDisplay(new Date(data.returnTime)),
				foodInfo
			})
		);

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
 * Create a collector for the expedition choice menu
 */
export async function createPetExpeditionChoiceCollector(
	context: PacketContext,
	packet: ReactionCollectorCreationPacket
): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return null;
	}

	const data = packet.data.data as ReactionCollectorPetExpeditionChoiceData;
	const lng = interaction.userLanguage;

	const petDisplay = `${DisplayUtils.getPetIcon(data.petId, data.petSex)} **${DisplayUtils.getPetNicknameOrTypeName(data.petNickname ?? null, data.petId, data.petSex, lng)}**`;

	// Build the embed with expedition options
	let description = i18n.t("commands:petExpedition.chooseExpedition", {
		lng,
		petDisplay
	});

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("expedition_choice")
		.setPlaceholder(i18n.t("commands:petExpedition.selectPlaceholder", { lng }));

	for (let i = 0; i < data.expeditions.length; i++) {
		const exp = data.expeditions[i];
		const locationEmoji = ExpeditionConstants.getLocationEmoji(exp.locationType);
		const locationName = getExpeditionLocationName(lng, exp.mapLocationId, exp.isDistantExpedition);

		// Use displayDurationMinutes (rounded to nearest 10) for the selection menu
		const displayDuration = minutesDisplay(exp.displayDurationMinutes, lng);
		const foodCost = exp.foodCost ?? 1;
		const foodDisplay = i18n.t("commands:petExpedition.foodCost", {
			lng,
			count: foodCost
		});

		description += i18n.t("commands:petExpedition.expeditionOption", {
			lng,
			number: i + 1,
			location: `${locationEmoji} **${locationName}**`,
			duration: displayDuration,
			risk: getTranslatedRiskCategoryName(exp.riskRate, lng),
			wealth: getTranslatedWealthCategoryName(exp.wealthRate, lng),
			difficulty: getTranslatedDifficultyCategoryName(exp.difficulty, lng),
			foodDisplay
		});

		selectMenu.addOptions({
			label: `${locationEmoji} ${locationName}`.substring(0, 100),
			description: `${displayDuration} - ${getTranslatedRiskCategoryName(exp.riskRate, lng)}`,
			value: exp.id
		});
	}

	// Add guild provisions info with pet excitement text
	const sexContext = getSexContext(data.petSex);
	if (data.hasGuild && data.guildFoodAmount !== undefined) {
		description += i18n.t("commands:petExpedition.guildProvisionsInfo", {
			lng,
			context: sexContext,
			petDisplay,
			amount: data.guildFoodAmount
		});
	}
	else {
		description += i18n.t("commands:petExpedition.noGuildProvisionsInfo", {
			lng,
			context: sexContext,
			petDisplay
		});
	}

	const embed = new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:petExpedition.chooseExpeditionTitle", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(description);

	const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
	const buttonRow = new ActionRowBuilder<ButtonBuilder>();

	const cancelButton = new ButtonBuilder()
		.setCustomId("expedition_cancel")
		.setLabel(i18n.t("commands:petExpedition.cancelButton", { lng }))
		.setEmoji(CrowniclesIcons.expedition.recall)
		.setStyle(ButtonStyle.Danger);
	buttonRow.addComponents(cancelButton);

	const msg = await interaction.channel.send({
		embeds: [embed],
		components: [selectRow, buttonRow]
	});

	if (!msg) {
		return null;
	}

	const collector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	collector.on("collect", async componentInteraction => {
		if (componentInteraction.user.id !== interaction.user.id) {
			await sendInteractionNotForYou(componentInteraction.user, componentInteraction, lng);
			return;
		}

		await componentInteraction.deferReply();

		if (componentInteraction.isStringSelectMenu()) {
			const menuInteraction = componentInteraction as StringSelectMenuInteraction;
			const chosenId = menuInteraction.values[0];

			// Find the index of the chosen expedition to send as reaction index
			const expeditionIndex = data.expeditions.findIndex((exp: ExpeditionOptionData) => exp.id === chosenId);
			if (expeditionIndex !== -1) {
				DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, menuInteraction, expeditionIndex);
			}
		}
		else if (componentInteraction.isButton()) {
			const buttonInteraction = componentInteraction as ButtonInteraction;
			if (buttonInteraction.customId === "expedition_cancel") {
				// Cancel - send reaction index = number of expeditions (last reaction is cancel)
				DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, data.expeditions.length);
			}
		}

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
 * Create a collector for the finished expedition view with claim option
 */
export async function createPetExpeditionFinishedCollector(
	context: PacketContext,
	packet: ReactionCollectorCreationPacket
): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return null;
	}

	const data = packet.data.data as ReactionCollectorPetExpeditionFinishedData;
	const lng = interaction.userLanguage;

	const locationEmoji = ExpeditionConstants.getLocationEmoji(data.locationType);
	const locationName = getExpeditionLocationName(lng, data.mapLocationId, data.isDistantExpedition);
	const petDisplay = `${DisplayUtils.getPetIcon(data.petId, data.petSex)} **${DisplayUtils.getPetNicknameOrTypeName(data.petNickname ?? null, data.petId, data.petSex, lng)}**`;
	const sexContext = getSexContext(data.petSex);

	const embed = new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:petExpedition.finishedTitle", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(
			i18n.t("commands:petExpedition.finishedDescription", {
				lng,
				context: sexContext,
				petDisplay,
				location: `${locationEmoji} ${locationName}`,
				risk: getTranslatedRiskCategoryName(data.riskRate, lng)
			})
		);

	const row = new ActionRowBuilder<ButtonBuilder>();
	const claimButton = new ButtonBuilder()
		.setCustomId("expedition_claim")
		.setLabel(i18n.t("commands:petExpedition.claimButton", { lng }))
		.setEmoji(CrowniclesIcons.expedition.map)
		.setStyle(ButtonStyle.Success);
	row.addComponents(claimButton);

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

		// Claim - defer reply as Core will send a response with rewards
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
