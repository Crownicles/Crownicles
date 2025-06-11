import { ICommand } from "../ICommand";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	NotificationsConfiguration,
	NotificationsConfigurations
} from "../../database/discord/models/NotificationsConfiguration";
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, parseEmoji, User
} from "discord.js";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import i18n from "../../translations/i18n";
import { Language } from "../../../../Lib/src/Language";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import {
	NotificationSendType, NotificationSendTypeEnum
} from "../../notifications/NotificationSendType";
import { NotificationsTypes } from "../../notifications/NotificationType";

/**
 * Map of the current notification configuration collectors
 *
 * Key: Discord user ID
 * Value: [Date of expiration of the collector, function to stop the collector]
 */
// eslint bug here, it considers that "Date, " is a function name

const currentCollectors = new Map<string, () => void>();


const backButtonCustomId = "back";
const forceStopReason = "force";

async function getPacket(interaction: CrowniclesInteraction): Promise<null> {
	const notificationsConfiguration = await NotificationsConfigurations.getOrRegister(interaction.user.id);

	await mainPage(interaction, notificationsConfiguration, interaction.userLanguage);

	return null;
}

function clearCurrentCollector(userId: string): void {
	const currentCollector = currentCollectors.get(userId);
	if (currentCollector) {
		currentCollector();
	}
}

async function mainPage(interaction: CrowniclesInteraction | ButtonInteraction, notificationsConfiguration: NotificationsConfiguration, lng: Language): Promise<void> {
	clearCurrentCollector(interaction.user.id);

	// Build the rows and buttons
	const chooseEnabledCustomId = "chooseEnabled";
	const chooseSendTypeCustomId = "chooseSendType";
	const chooseEnabledEmoji = CrowniclesIcons.notifications.bell;
	const chooseSendTypeEmoji = CrowniclesIcons.notifications.sendLocation;

	const row = new ActionRowBuilder<ButtonBuilder>();
	row.addComponents(new ButtonBuilder()
		.setEmoji(parseEmoji(chooseEnabledEmoji)!)
		.setCustomId(chooseEnabledCustomId)
		.setLabel(i18n.t("commands:notifications.enableDisable", { lng }))
		.setStyle(ButtonStyle.Secondary));
	const allTypesDisabled = NotificationsTypes.ALL.every(notificationType => !notificationType.value(notificationsConfiguration).enabled);
	if (!allTypesDisabled) {
		row.addComponents(new ButtonBuilder()
			.setEmoji(parseEmoji(chooseSendTypeEmoji)!)
			.setCustomId(chooseSendTypeCustomId)
			.setLabel(i18n.t("commands:notifications.sendLocation", { lng }))
			.setStyle(ButtonStyle.Secondary));
	}

	// Build and send the message
	let reply;
	const embed = getNotificationsEmbed(notificationsConfiguration, interaction.user, lng);
	if (!interaction.isButton()) {
		reply = await interaction.reply({ // Reply is picky on the signature, so the options can't be factorized into a single variable
			embeds: [embed],
			components: [row],
			withResponse: true
		});
	}
	else {
		reply = await (interaction as ButtonInteraction).update({
			embeds: [embed],
			components: [row],
			withResponse: true
		});
	}

	if (!reply?.resource?.message) {
		return;
	}

	const msg = reply.resource.message;

	// Create the collector
	const buttonCollector = msg.createMessageComponentCollector({
		time: Constants.MESSAGES.COLLECTOR_TIME
	});
	currentCollectors.set(interaction.user.id, (): void => buttonCollector.stop());

	buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		if (buttonInteraction.user.id !== interaction.user.id) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		if (buttonInteraction.customId === chooseEnabledCustomId) {
			buttonCollector.stop(forceStopReason);
			await chooseEnabled(buttonInteraction, notificationsConfiguration, lng);
			return;
		}

		if (buttonInteraction.customId === chooseSendTypeCustomId) {
			buttonCollector.stop(forceStopReason);
			await chooseSendType(buttonInteraction, notificationsConfiguration, lng);
		}
	});

	buttonCollector.on("end", async (_, reason) => {
		currentCollectors.delete(interaction.user.id);

		if (reason !== forceStopReason) {
			await msg.edit({ components: [] });
		}
	});
}

function getSettingsRows(notificationsConfiguration: NotificationsConfiguration, keepOnlyEnabled: boolean, lng: Language): ActionRowBuilder<ButtonBuilder>[] {
	const rowNotifications = new ActionRowBuilder<ButtonBuilder>();
	NotificationsTypes.ALL.forEach(notificationType => {
		if (keepOnlyEnabled && !notificationType.value(notificationsConfiguration).enabled) {
			return;
		}

		rowNotifications.addComponents(new ButtonBuilder()
			.setEmoji(parseEmoji(notificationType.emote)!)
			.setCustomId(notificationType.customId)
			.setLabel(i18n.t(notificationType.i18nKey, { lng }))
			.setStyle(ButtonStyle.Secondary));
	});
	const rowBack = new ActionRowBuilder<ButtonBuilder>();
	rowBack.addComponents(new ButtonBuilder()
		.setEmoji(parseEmoji(CrowniclesIcons.notifications.back)!)
		.setLabel(i18n.t("commands:notifications.back", { lng }))
		.setCustomId(backButtonCustomId)
		.setStyle(ButtonStyle.Secondary));

	return [rowNotifications, rowBack];
}

async function chooseEnabled(buttonInteraction: ButtonInteraction, notificationsConfiguration: NotificationsConfiguration, lng: Language): Promise<void> {
	clearCurrentCollector(buttonInteraction.user.id);

	// Build the rows and buttons
	const rows = getSettingsRows(notificationsConfiguration, false, lng);

	// Build and send the message
	const embed = getNotificationsEmbed(notificationsConfiguration, buttonInteraction.user, lng, i18n.t("commands:notifications.footerEnableDisable", { lng }));
	const msg = await buttonInteraction.update({
		embeds: [embed], components: rows
	});

	// Create the collector
	const buttonCollector = msg.createMessageComponentCollector({
		time: Constants.MESSAGES.COLLECTOR_TIME
	});
	currentCollectors.set(buttonInteraction.user.id, (): void => buttonCollector.stop());

	buttonCollector.on("collect", async (collectorButtonInteraction: ButtonInteraction) => {
		if (collectorButtonInteraction.user.id !== buttonInteraction.user.id) {
			await sendInteractionNotForYou(collectorButtonInteraction.user, collectorButtonInteraction, lng);
			return;
		}

		if (collectorButtonInteraction.customId === backButtonCustomId) {
			buttonCollector.stop(forceStopReason);
			await mainPage(collectorButtonInteraction, notificationsConfiguration, lng);
			return;
		}

		const notificationType = NotificationsTypes.ALL.find(notificationType => notificationType.customId === collectorButtonInteraction.customId);
		if (notificationType) {
			notificationType.toggleCallback(notificationsConfiguration);
			await notificationsConfiguration.save();
			const embed = getNotificationsEmbed(notificationsConfiguration, collectorButtonInteraction.user, lng, i18n.t("commands:notifications.footerEnableDisable", { lng }));
			await collectorButtonInteraction.update({
				embeds: [embed],
				components: rows
			});
		}
	});

	buttonCollector.on("end", async (_, reason) => {
		currentCollectors.delete(buttonInteraction.user.id);

		await notificationsConfiguration.save();

		if (reason !== forceStopReason) {
			await msg.edit({ components: [] });
		}
	});
}

async function chooseSendType(buttonInteraction: ButtonInteraction, notificationsConfiguration: NotificationsConfiguration, lng: Language): Promise<void> {
	clearCurrentCollector(buttonInteraction.user.id);

	// Build the rows and buttons
	const rows = getSettingsRows(notificationsConfiguration, true, lng);

	// Build and send the message
	const embed = getNotificationsEmbed(notificationsConfiguration, buttonInteraction.user, lng, i18n.t("commands:notifications.footerSendLocation", { lng }));
	const msg = await buttonInteraction.update({
		embeds: [embed], components: rows
	});

	// Create the collector
	const buttonCollector = msg.createMessageComponentCollector({
		time: Constants.MESSAGES.COLLECTOR_TIME
	});
	currentCollectors.set(buttonInteraction.user.id, (): void => buttonCollector.stop());

	buttonCollector.on("collect", async (collectorButtonInteraction: ButtonInteraction) => {
		if (buttonInteraction.user.id !== collectorButtonInteraction.user.id) {
			await sendInteractionNotForYou(collectorButtonInteraction.user, collectorButtonInteraction, lng);
			return;
		}

		if (collectorButtonInteraction.customId === backButtonCustomId) {
			buttonCollector.stop(forceStopReason);
			await mainPage(collectorButtonInteraction, notificationsConfiguration, lng);
			return;
		}

		const notificationType = NotificationsTypes.ALL.find(notificationType => notificationType.customId === collectorButtonInteraction.customId);
		if (notificationType) {
			notificationType.changeSendTypeCallback(
				notificationsConfiguration,
				(notificationType.value(notificationsConfiguration).sendType + 1) % (Object.keys(NotificationSendTypeEnum).length / 2),
				buttonInteraction.channel!.id
			);
			await notificationsConfiguration.save();

			const embed = getNotificationsEmbed(notificationsConfiguration, collectorButtonInteraction.user, lng, i18n.t("commands:notifications.footerSendLocation", { lng }));
			await collectorButtonInteraction.update({
				embeds: [embed],
				components: rows
			});
		}
	});

	buttonCollector.on("end", async (_, reason) => {
		currentCollectors.delete(buttonInteraction.user.id);
		await notificationsConfiguration.save();

		if (reason !== forceStopReason) {
			await msg.edit({ components: [] });
		}
	});
}

function getNotificationsEmbed(notificationsConfiguration: NotificationsConfiguration, user: User, lng: Language, footer?: string): CrowniclesEmbed {
	let description = "";
	NotificationsTypes.ALL.forEach(notificationType => {
		const notificationTypeValue = notificationType.value(notificationsConfiguration);
		const sendLocation = NotificationSendType.toString(notificationTypeValue.sendType, lng, notificationTypeValue.channelId);
		description
			+= `${notificationType.emote} **__${i18n.t(notificationType.i18nKey, { lng })}__**
- **${i18n.t("commands:notifications.enabledField", { lng })}** ${notificationTypeValue.enabled ? CrowniclesIcons.collectors.accept : CrowniclesIcons.collectors.refuse}`;
		if (notificationTypeValue.enabled) {
			description += `\n- **${i18n.t("commands:notifications.sendLocationField", { lng })}** ${sendLocation}`;
		}
		description += "\n\n";
	});

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:notifications.embedTitle", { lng }), user)
		.setDescription(description);
	if (footer) {
		embed.setFooter({ text: footer });
	}

	return embed;
}

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("notifications"),
	getPacket,
	mainGuildCommand: false
};
