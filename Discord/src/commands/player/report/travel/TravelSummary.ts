import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, parseEmoji
} from "discord.js";
import {
	makePacket, PacketContext
} from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportBuyHealPacketReq,
	CommandReportTravelSummaryRes,
	CommandReportUseTokensPacketReq
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { Constants } from "../../../../../../Lib/src/constants/Constants";
import { Language } from "../../../../../../Lib/src/Language";
import {
	asMilliseconds,
	millisecondsToHours,
	millisecondsToMinutes,
	printTimeBeforeDate
} from "../../../../../../Lib/src/utils/TimeUtils";
import { DiscordCache } from "../../../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import { CrowniclesInteraction } from "../../../../messages/CrowniclesInteraction";
import i18n from "../../../../translations/i18n";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import {
	effectsErrorTextValue, sendInteractionNotForYou
} from "../../../../utils/ErrorUtils";
import { PacketUtils } from "../../../../utils/PacketUtils";

type FieldsArguments = {
	packet: CommandReportTravelSummaryRes;
	lng: Language;
	travelEmbed: CrowniclesEmbed;
};

function isCurrentlyInEffect(packet: CommandReportTravelSummaryRes, now: number): boolean {
	const effectStartTime = packet.effectEndTime && packet.effectDuration ? packet.effectEndTime - packet.effectDuration : 0;
	return !(now < effectStartTime || now > (packet.effectEndTime ?? 0));
}

function computePlayerTravelledTime(packet: CommandReportTravelSummaryRes, now: number, isInEffectTime: boolean): number {
	let playerTravelledTime = now - packet.startTime;
	const effectStartTime = packet.effectEndTime && packet.effectDuration ? packet.effectEndTime - packet.effectDuration : 0;
	if (now > (packet.effectEndTime ?? 0)) {
		playerTravelledTime -= packet.effectDuration ?? 0;
	}
	else if (isInEffectTime) {
		playerTravelledTime -= now - effectStartTime;
	}
	return playerTravelledTime;
}

function formatRemainingTime(playerRemainingTravelTime: number): string {
	const remainingHours = Math.max(Math.floor(millisecondsToHours(asMilliseconds(playerRemainingTravelTime))), 0);
	let remainingMinutes = Math.floor(millisecondsToMinutes(asMilliseconds(playerRemainingTravelTime - remainingHours * 3600000)));
	if (remainingMinutes === 60) {
		remainingMinutes = 59;
	}
	if (remainingMinutes <= 0 && remainingHours === 0) {
		remainingMinutes = 1;
	}
	return `**[${remainingHours}h${remainingMinutes < 10 ? "0" : ""}${remainingMinutes}]**`;
}

function getPlayerPositionEmoji(packet: CommandReportTravelSummaryRes, isInEffectTime: boolean): string {
	if (isInEffectTime) {
		return CrowniclesIcons.effects[packet.effect!];
	}
	return packet.isOnBoat ? "🚢" : "🧍";
}

function buildTravelPathSquares(
	packet: CommandReportTravelSummaryRes, playerIndex: number, isInEffectTime: boolean, timeRemainingString: string
): string {
	const playerEmoji = getPlayerPositionEmoji(packet, isInEffectTime);
	const middleIndex = Math.floor(Constants.REPORT.PATH_SQUARE_COUNT / 2) - 1;
	let str = "";
	for (let j = 0; j < Constants.REPORT.PATH_SQUARE_COUNT; ++j) {
		str += j === playerIndex ? playerEmoji : "■";
		if (j === middleIndex) {
			str += timeRemainingString;
		}
	}
	return str;
}

function generateTravelPathString(packet: CommandReportTravelSummaryRes, now: number): string {
	const tripDuration = packet.arriveTime - packet.startTime - (packet.effectDuration ?? 0);
	const isInEffectTime = isCurrentlyInEffect(packet, now);
	const playerTravelledTime = computePlayerTravelledTime(packet, now, isInEffectTime);
	const playerRemainingTravelTime = tripDuration - playerTravelledTime;

	const percentage = Math.min(playerTravelledTime / tripDuration, 1);
	const playerIndex = Math.floor(Constants.REPORT.PATH_SQUARE_COUNT * percentage);
	const timeRemainingString = formatRemainingTime(playerRemainingTravelTime);

	const squares = buildTravelPathSquares(packet, playerIndex, isInEffectTime, timeRemainingString);
	return `${CrowniclesIcons.mapTypes[packet.startMap.type]} ${squares} ${CrowniclesIcons.mapTypes[packet.endMap.type]}`;
}

function manageMainSummaryText({
	packet,
	lng,
	travelEmbed
}: FieldsArguments, escapedPseudo: string, now: number): void {
	if (isCurrentlyInEffect(packet, now)) {
		const errorMessageObject = effectsErrorTextValue(escapedPseudo, lng, true, packet.effect!, packet.effectEndTime! - now);
		travelEmbed.addFields({
			name: errorMessageObject.title,
			value: errorMessageObject.description,
			inline: false
		});
		return;
	}
	if (packet.nextStopTime > packet.arriveTime) {
		travelEmbed.addFields({
			name: i18n.t("commands:report.travellingTitle", { lng }),
			value: i18n.t("commands:report.travellingDescriptionEndTravel", { lng })
		});
		return;
	}

	const timeBeforeSmallEvent = printTimeBeforeDate(packet.nextStopTime);
	travelEmbed.addFields({
		name: i18n.t("commands:report.travellingTitle", { lng }),
		value: packet.lastSmallEventId
			? i18n.t("commands:report.travellingDescription", {
				lng,
				smallEventEmoji: CrowniclesIcons.smallEvents[packet.lastSmallEventId],
				time: timeBeforeSmallEvent
			})
			: i18n.t("commands:report.travellingDescriptionWithoutSmallEvent", {
				lng,
				time: timeBeforeSmallEvent
			})
	});
}

function manageEndPathDescriptions({
	packet,
	lng,
	travelEmbed
}: FieldsArguments): void {
	travelEmbed.addFields({
		name: i18n.t("commands:report.startPoint", { lng }),
		value: `${CrowniclesIcons.mapTypes[packet.startMap.type]} ${i18n.t(`models:map_locations.${packet.startMap.id}.name`, { lng })}`,
		inline: true
	});
	travelEmbed.addFields({
		name: i18n.t("commands:report.endPoint", { lng }),
		value: `${CrowniclesIcons.mapTypes[packet.endMap.type]} ${i18n.t(`models:map_locations.${packet.endMap.id}.name`, { lng })}`,
		inline: true
	});
}

function addEnergyAndPointsFields(
	travelEmbed: CrowniclesEmbed,
	packet: CommandReportTravelSummaryRes,
	lng: Language
): void {
	if (packet.energy.show) {
		travelEmbed.addFields({
			name: i18n.t("commands:report.remainingEnergyTitle", { lng }),
			value: `${CrowniclesIcons.unitValues.energy} ${packet.energy.current} / ${packet.energy.max}`,
			inline: true
		});
	}
	if (packet.points.show) {
		travelEmbed.addFields({
			name: i18n.t("commands:report.collectedPointsTitle", { lng }),
			value: `${CrowniclesIcons.unitValues.score} ${DisplayUtils.formatNumber(packet.points.cumulated, lng)}`,
			inline: true
		});
	}
}

function addAdviceField(travelEmbed: CrowniclesEmbed, lng: Language): void {
	const advices = i18n.tArray("advices:advices", {
		lng
	});
	travelEmbed.addFields({
		name: i18n.t("commands:report.adviceTitle", { lng }),
		value: advices[Math.floor(Math.random() * advices.length)],
		inline: true
	});
}

interface ButtonConfig {
	customId: string;
	hasEnough: boolean;
	sufficientLabel: string;
	insufficientLabel: string;
	emoji: string;
	sufficientStyle: ButtonStyle;
}

function createCurrencyButton(config: ButtonConfig): ButtonBuilder {
	return new ButtonBuilder()
		.setCustomId(config.customId)
		.setLabel(config.hasEnough ? config.sufficientLabel : config.insufficientLabel)
		.setEmoji(parseEmoji(config.emoji)!)
		.setStyle(config.hasEnough ? config.sufficientStyle : ButtonStyle.Secondary)
		.setDisabled(!config.hasEnough);
}

type CurrencyButtonConfig = {
	resource: {
		playerAmount: number; cost: number;
	} | undefined;
	customId: string;
	sufficientLabelKey: string;
	insufficientLabelKey: string;
	emoji: string;
	sufficientStyle: ButtonStyle;
};

function createCurrencyButtonFromPacket(config: CurrencyButtonConfig, lng: Language): ButtonBuilder | null {
	if (!config.resource) {
		return null;
	}
	return createCurrencyButton({
		customId: config.customId,
		hasEnough: config.resource.playerAmount >= config.resource.cost,
		sufficientLabel: i18n.t(config.sufficientLabelKey, { lng }),
		insufficientLabel: i18n.t(config.insufficientLabelKey, { lng }),
		emoji: config.emoji,
		sufficientStyle: config.sufficientStyle
	});
}

const TRAVEL_CURRENCY_BUTTONS: ((packet: CommandReportTravelSummaryRes) => CurrencyButtonConfig)[] = [
	(packet): CurrencyButtonConfig => ({
		resource: packet.heal && {
			playerAmount: packet.heal.playerMoney, cost: packet.heal.price
		},
		customId: "buyHeal",
		sufficientLabelKey: "commands:report.buyHealButton",
		insufficientLabelKey: "commands:report.notEnoughMoneyHealButton",
		emoji: CrowniclesIcons.shopItems.healAlteration,
		sufficientStyle: ButtonStyle.Success
	}),
	(packet): CurrencyButtonConfig => ({
		resource: packet.tokens && {
			playerAmount: packet.tokens.playerTokens, cost: packet.tokens.cost
		},
		customId: "useTokens",
		sufficientLabelKey: "commands:report.useTokensButton",
		insufficientLabelKey: "commands:report.notEnoughTokensButton",
		emoji: CrowniclesIcons.unitValues.token,
		sufficientStyle: ButtonStyle.Primary
	})
];

function buildTravelActionRow(packet: CommandReportTravelSummaryRes, lng: Language): ActionRowBuilder<ButtonBuilder> | null {
	const row = new ActionRowBuilder<ButtonBuilder>();
	for (const buildConfig of TRAVEL_CURRENCY_BUTTONS) {
		const button = createCurrencyButtonFromPacket(buildConfig(packet), lng);
		if (button) {
			row.addComponents(button);
		}
	}
	return row.components.length > 0 ? row : null;
}

function hasInteractiveButton(packet: CommandReportTravelSummaryRes): boolean {
	const tokensInteractive = packet.tokens && packet.tokens.playerTokens >= packet.tokens.cost;
	const healInteractive = packet.heal && packet.heal.playerMoney >= packet.heal.price;
	return Boolean(tokensInteractive || healInteractive);
}

async function handleTravelButtonInteraction(
	buttonInteraction: ButtonInteraction,
	context: PacketContext,
	lng: Language
): Promise<void> {
	if (buttonInteraction.customId === "useTokens") {
		await buttonInteraction.followUp({
			content: i18n.t("commands:report.useTokensLoading", { lng }),
			ephemeral: false
		}).then(msg => msg.delete().catch(() => null));

		PacketUtils.sendPacketToBackend(context, makePacket(CommandReportUseTokensPacketReq, {}));
	}
	else if (buttonInteraction.customId === "buyHeal") {
		await buttonInteraction.followUp({
			content: i18n.t("commands:report.buyHealLoading", { lng }),
			ephemeral: false
		}).then(msg => msg.delete().catch(() => null));

		PacketUtils.sendPacketToBackend(context, makePacket(CommandReportBuyHealPacketReq, {}));
	}
}

function setupTravelButtonCollector(
	msg: NonNullable<Awaited<ReturnType<CrowniclesInteraction["editReply"]>>>,
	row: ActionRowBuilder<ButtonBuilder>,
	context: PacketContext,
	lng: Language
): void {
	const buttonCollector = msg.createMessageComponentCollector({
		time: Constants.MESSAGES.COLLECTOR_TIME
	});

	buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		if (buttonInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		row.components.forEach(button => button.setDisabled(true));
		await buttonInteraction.update({ components: [row] });

		await handleTravelButtonInteraction(buttonInteraction, context, lng);
		buttonCollector.stop();
	});

	buttonCollector.on("end", async () => {
		row.components.forEach(button => button.setDisabled(true));
		await msg.edit({ components: [row] }).catch(() => null);
	});
}

export async function reportTravelSummary(packet: CommandReportTravelSummaryRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const now = Date.now();
	const travelEmbed = new CrowniclesEmbed();
	travelEmbed.formatAuthor(i18n.t("commands:report.travelPathTitle", { lng }), interaction.user);
	travelEmbed.setDescription(generateTravelPathString(packet, now));
	const fieldsArguments = {
		packet,
		lng,
		travelEmbed
	};
	manageEndPathDescriptions(fieldsArguments);
	manageMainSummaryText(fieldsArguments, await DisplayUtils.getEscapedUsername(context.keycloakId!, lng), now);
	addEnergyAndPointsFields(travelEmbed, packet, lng);
	addAdviceField(travelEmbed, lng);

	const row = buildTravelActionRow(packet, lng);

	if (!row) {
		await interaction.editReply({ embeds: [travelEmbed] });
		return;
	}

	const msg = await interaction.editReply({
		embeds: [travelEmbed],
		components: [row]
	});

	if (hasInteractiveButton(packet) && msg) {
		setupTravelButtonCollector(msg, row, context, lng);
	}
}
