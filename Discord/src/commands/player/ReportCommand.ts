import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandReportBigEventResultRes,
	CommandReportBuyHealAcceptPacketRes,
	CommandReportBuyHealPacketReq,
	CommandReportMonsterRewardRes,
	CommandReportPacketReq,
	CommandReportRefusePveFightRes,
	CommandReportTravelSummaryRes,
	CommandReportUseTokensAcceptPacketRes,
	CommandReportUseTokensPacketReq
} from "../../../../Lib/src/packets/commands/CommandReportPacket";
import {
	ReactionCollectorBigEventPacket
} from "../../../../Lib/src/packets/interaction/ReactionCollectorBigEvent";
import i18n, { TranslationOption } from "../../translations/i18n";
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, parseEmoji
} from "discord.js";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import {
	effectsErrorTextValue, sendInteractionNotForYou
} from "../../utils/ErrorUtils";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { Effect } from "../../../../Lib/src/types/Effect";
import {
	millisecondsToHours,
	millisecondsToMinutes,
	minutesDisplay,
	printTimeBeforeDate
} from "../../../../Lib/src/utils/TimeUtils";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import {
	ReactionCollectorChooseDestinationPacket
} from "../../../../Lib/src/packets/interaction/ReactionCollectorChooseDestination";
import {
	DiscordCollectorUtils,
	disableRows
} from "../../utils/DiscordCollectorUtils";
import { ReactionCollectorUseTokensPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorUseTokens";
import { ReactionCollectorBuyHealPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorBuyHeal";
import { ReportConstants } from "../../../../Lib/src/constants/ReportConstants";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { DiscordConstants } from "../../DiscordConstants";
import { ReactionCollectorPveFightPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPveFight";
import {
	escapeUsername, StringUtils
} from "../../utils/StringUtils";
import { Language } from "../../../../Lib/src/Language";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { PetUtils } from "../../utils/PetUtils";
import { SexTypeShort } from "../../../../Lib/src/constants/StringConstants";
import { PacketUtils } from "../../utils/PacketUtils";
import { createConfirmationCollector } from "../../utils/ReportConfirmationCollector";

async function getPacket(interaction: CrowniclesInteraction): Promise<CommandReportPacketReq> {
	await interaction.deferReply();
	return makePacket(CommandReportPacketReq, {});
}

/**
 * Display the big event collector that allows the player to choose the possibility of the big event
 * @param context
 * @param packet
 */
export async function createBigEventCollector(context: PacketContext, packet: ReactionCollectorBigEventPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;
	const data = packet.data.data;
	const reactions = packet.reactions.map(reaction => reaction.data);

	const rows = [new ActionRowBuilder<ButtonBuilder>()];
	let eventText = `${i18n.t(`events:${data.eventId}.text`, {
		lng
	})}\n\n`;
	for (const possibility of reactions) {
		if (possibility.name !== ReportConstants.END_POSSIBILITY_ID) {
			const emoji = CrowniclesIcons.events[data.eventId.toString()][possibility.name] as string;

			const button = new ButtonBuilder()
				.setEmoji(parseEmoji(emoji)!)
				.setCustomId(possibility.name)
				.setStyle(ButtonStyle.Secondary);

			if (rows[rows.length - 1].components.length >= DiscordConstants.MAX_BUTTONS_PER_ROW) {
				rows.push(new ActionRowBuilder<ButtonBuilder>());
			}
			rows[rows.length - 1].addComponents(button);

			const reactionText = `${emoji} ${i18n.t(`events:${data.eventId}.possibilities.${possibility.name}.text`, {
				lng
			})}`;
			eventText += `${reactionText}\n`;
		}
	}

	const msg = (await interaction.editReply({
		content: i18n.t("commands:report.doEvent", {
			lng,
			event: eventText,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}),
		components: rows
	}))!;

	let responded = false; // To avoid concurrence between the button controller and reaction controller
	const respondToEvent = (possibilityName: string, buttonInteraction: ButtonInteraction | null): void => {
		if (!responded) {
			responded = true;
			DiscordCollectorUtils.sendReaction(packet, context, context.keycloakId!, buttonInteraction, reactions.findIndex(reaction => reaction.name === possibilityName));
		}
	};

	const buttonCollector = msg.createMessageComponentCollector({
		time: packet.endTime - Date.now()
	});

	const endCollector = msg.createReactionCollector({
		time: packet.endTime - Date.now(),
		filter: (reaction, user) => reaction.emoji.name === CrowniclesIcons.messages.notReplied && user.id === interaction.user.id
	});

	buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
		if (buttonInteraction.user.id !== context.discord?.user) {
			await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
			return;
		}

		await buttonInteraction.deferReply();
		respondToEvent(buttonInteraction.customId, buttonInteraction);
	});

	endCollector.on("collect", () => {
		respondToEvent(ReportConstants.END_POSSIBILITY_ID, null);
	});

	buttonCollector.on("end", async () => {
		// Disable buttons instead of removing them
		disableRows(rows);

		await msg.edit({ components: rows });
	});

	return [buttonCollector, endCollector];
}

type Condition = boolean | number | undefined;
type ConditionTriplet = [Condition, string, Omit<TranslationOption, "lng">];

function getReportResultConditionTriplets(packet: CommandReportBigEventResultRes, lng: Language): ConditionTriplet[] {
	return [
		[
			packet.score,
			"points",
			{ score: packet.score }
		],
		[
			packet.money < 0,
			"moneyLoose",
			{ money: -packet.money }
		],
		[
			packet.money > 0,
			"money",
			{ money: packet.money }
		],
		[
			packet.health < 0,
			"healthLoose",
			{ health: -packet.health }
		],
		[
			packet.health > 0,
			"health",
			{ health: packet.health }
		],
		[
			packet.energy,
			"energy",
			{ energy: packet.energy }
		],
		[
			packet.gems,
			"gems",
			{ gems: packet.gems }
		],
		[
			packet.experience,
			"experience",
			{ experience: packet.experience }
		],
		[
			packet.effect?.name === Effect.OCCUPIED.id,
			"timeLost",
			{ timeLost: packet.effect ? minutesDisplay(packet.effect.time, lng) : 0 }
		]
	];
}

/**
 * Display the result of the big event
 * @param packet
 * @param context
 */
export async function reportResult(packet: CommandReportBigEventResultRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;

	const result = getReportResultConditionTriplets(packet, lng)
		.map(triplet => (triplet[0]
			? i18n.t(`commands:report.${triplet[1]}`, {
				lng,
				...triplet[2]
			})
			: ""))
		.join("");

	const content = i18n.t("commands:report.doPossibility", {
		lng,
		pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng),
		result,
		event: i18n.t(`events:${packet.eventId}.possibilities.${packet.possibilityId}.outcomes.${packet.outcomeId}`, { lng }),
		emoji: packet.possibilityId === ReportConstants.END_POSSIBILITY_ID
			? CrowniclesIcons.events[packet.eventId].end[packet.outcomeId]
			: CrowniclesIcons.events[packet.eventId][packet.possibilityId] as string,
		alte: packet.effect && packet.effect.name !== Effect.OCCUPIED.id ? CrowniclesIcons.effects[packet.effect.name] : ""
	});

	const buttonInteraction = context.discord?.buttonInteraction ? DiscordCache.getButtonInteraction(context.discord?.buttonInteraction) : null;

	if (buttonInteraction) {
		await buttonInteraction.editReply({ content });
	}
	else {
		await interaction.channel.send({ content });
	}
}

/**
 * Display the travel destination collector that allows the player to choose the destination of his next trip
 * @param context
 * @param packet
 */
export async function chooseDestinationCollector(context: PacketContext, packet: ReactionCollectorChooseDestinationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction.userLanguage;

	const embed = new CrowniclesEmbed();
	embed.formatAuthor(i18n.t("commands:report.destinationTitle", {
		lng,
		pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
	}), interaction.user);
	embed.setDescription(`${i18n.t("commands:report.chooseDestinationIndications", { lng })}\n\n`);

	return await DiscordCollectorUtils.createChoiceListCollector(interaction, {
		packet,
		context
	}, {
		embed,
		items: packet.reactions.map(reaction => {
			const destinationReaction = reaction.data;

			// If the trip duration is hidden, the translation module is used with a 2 hours placeholder and the 2 is replaced by a ? afterward
			const duration = destinationReaction.tripDuration
				? minutesDisplay(destinationReaction.tripDuration, lng)
				: minutesDisplay(120, lng)
					.replace("2", "?");
			return `${
				CrowniclesIcons.mapTypes[destinationReaction.mapTypeId]
			} ${
				i18n.t(`models:map_locations.${destinationReaction.mapId}.name`, { lng })} (${duration})`;
		})
	}, { refuse: { can: false } });
}

function isCurrentlyInEffect(packet: CommandReportTravelSummaryRes, now: number): boolean {
	const effectStartTime = packet.effectEndTime && packet.effectDuration ? packet.effectEndTime - packet.effectDuration : 0;
	return !(now < effectStartTime || now > (packet.effectEndTime ?? 0));
}

/**
 * Generates a string representing the player walking from a map to another
 * @param packet
 * @param now
 * @returns
 */
function generateTravelPathString(packet: CommandReportTravelSummaryRes, now: number): string {
	// Calculate trip duration
	const tripDuration = packet.arriveTime - packet.startTime - (packet.effectDuration ?? 0);

	// Player travelled time
	let playerTravelledTime = now - packet.startTime;
	const isInEffectTime = isCurrentlyInEffect(packet, now);
	const effectStartTime = packet.effectEndTime && packet.effectDuration ? packet.effectEndTime - packet.effectDuration : 0;
	if (now > (packet.effectEndTime ?? 0)) {
		playerTravelledTime -= packet.effectDuration ?? 0;
	}
	else if (isInEffectTime) {
		playerTravelledTime -= now - effectStartTime;
	}

	const playerRemainingTravelTime = tripDuration - playerTravelledTime;

	let percentage = playerTravelledTime / tripDuration;

	const remainingHours = Math.max(Math.floor(millisecondsToHours(playerRemainingTravelTime)), 0);
	let remainingMinutes = Math.floor(millisecondsToMinutes(playerRemainingTravelTime - remainingHours * 3600000));
	if (remainingMinutes === 60) {
		remainingMinutes = 59;
	}
	if (remainingMinutes <= 0 && remainingHours === 0) {
		remainingMinutes = 1;
	}
	const timeRemainingString = `**[${remainingHours}h${remainingMinutes < 10 ? "0" : ""}${remainingMinutes}]**`;
	if (percentage > 1) {
		percentage = 1;
	}
	let index = Constants.REPORT.PATH_SQUARE_COUNT * percentage;

	index = Math.floor(index);

	let str = `${CrowniclesIcons.mapTypes[packet.startMap.type]} `;

	for (let j = 0; j < Constants.REPORT.PATH_SQUARE_COUNT; ++j) {
		if (j === index) {
			if (!isInEffectTime) {
				str += packet.isOnBoat ? "🚢" : "🧍";
			}
			else {
				str += CrowniclesIcons.effects[packet.effect!];
			}
		}
		else {
			str += "■";
		}
		if (j === Math.floor(Constants.REPORT.PATH_SQUARE_COUNT / 2) - 1) {
			str += timeRemainingString;
		}
	}

	return `${str} ${CrowniclesIcons.mapTypes[packet.endMap.type]}`;
}

/**
 * Display embed with the presentation of the monster the player will fight,
 * leaves the choice to the player to not fight immediately
 * @param context
 * @param packet
 */
export async function handleStartPveFight(context: PacketContext, packet: ReactionCollectorPveFightPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const data = packet.data.data;
	const lng = interaction.userLanguage;
	const msg = i18n.t("commands:report.pveEvent", {
		lng,
		pseudo: escapeUsername(interaction.user.displayName),
		event: i18n.t(`models:pveMapsStory.${data.mapId}.${data.monster.id}`, { lng }),
		monsterDisplay: i18n.t("commands:report.encounterMonsterStats", {
			lng,
			monsterName: i18n.t(`models:monsters.${data.monster.id}.name`, { lng }),
			emoji: CrowniclesIcons.monsters[data.monster.id],
			description: i18n.t(`models:monsters.${data.monster.id}.description`, { lng }),
			level: data.monster.level,
			energy: data.monster.energy,
			attack: data.monster.attack,
			defense: data.monster.defense,
			speed: data.monster.speed
		})
	});

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, msg, packet, context, {
		emojis: {
			accept: CrowniclesIcons.pveFights.startFight,
			refuse: CrowniclesIcons.pveFights.waitABit
		}
	});
}

/**
 * Display to the user a message when the fight against a monster has been refused
 * @param context
 * @param _packet
 */
export async function refusePveFight(_packet: CommandReportRefusePveFightRes, context: PacketContext): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!originalInteraction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	await buttonInteraction?.editReply({
		content: i18n.t("commands:report.pveFightRefused", {
			lng: originalInteraction.userLanguage,
			pseudo: escapeUsername(originalInteraction.user.displayName)
		})
	});
}

/**
 * Display to the player the things that he won after the fight
 * @param packet
 * @param context
 */
export async function displayMonsterReward(
	packet: CommandReportMonsterRewardRes,
	context: PacketContext
): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!originalInteraction) {
		return;
	}

	const lng = originalInteraction.userLanguage;

	const {
		user,
		channel
	} = originalInteraction;
	const descriptionParts: string[] = [];

	descriptionParts.push(
		i18n.t("commands:report.monsterRewardsDescription", {
			lng,
			money: packet.money,
			experience: packet.experience
		})
	);

	if (packet.guildXp > 0) {
		descriptionParts.push(
			i18n.t("commands:report.monsterRewardGuildXp", {
				lng,
				guildXp: packet.guildXp
			})
		);
	}

	if (packet.guildPoints > 0) {
		descriptionParts.push(
			i18n.t("commands:report.monsterRewardsGuildPoints", {
				lng,
				guildPoints: packet.guildPoints
			})
		);
	}

	if (packet.petReaction) {
		const petDisplay = PetUtils.petToShortString(lng, packet.petReaction.petNickname, packet.petReaction.petId, packet.petReaction.petSex as SexTypeShort);
		const petReactionText = StringUtils.getRandomTranslation(`commands:fight.petReactions.${packet.petReaction.reactionType}`, lng, {
			player: escapeUsername(user.displayName),
			pet: petDisplay
		});
		descriptionParts.push(`\n${petReactionText}`);
	}

	const embed = new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:report.rewardEmbedTitle", {
				lng,
				pseudo: escapeUsername(user.displayName)
			}),
			user
		)
		.setDescription(descriptionParts.join("\n"));

	await channel.send({ embeds: [embed] });
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
		// If there is no small event before the big event, do not display anything
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

type FieldsArguments = {
	packet: CommandReportTravelSummaryRes;
	lng: Language;
	travelEmbed: CrowniclesEmbed;
};

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

/**
 * Handle the response when player successfully uses tokens to advance
 * @param packet
 * @param context
 */
export async function handleUseTokensAccept(packet: CommandReportUseTokensAcceptPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = interaction.userLanguage;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.tokensUsedSuccessTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.tokensUsedSuccessDescription", {
			lng,
			count: packet.tokensSpent,
			nextStep: packet.isArrived
				? i18n.t("commands:report.tokensNextStepArrived", { lng })
				: i18n.t("commands:report.tokensNextStepSmallEvent", { lng })
		}));

	await buttonInteraction?.editReply({ embeds: [embed] });
}

/**
 * Handle the response when player refuses to use tokens
 * @param context
 */
export async function handleUseTokensRefuse(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = interaction.userLanguage;

	await buttonInteraction?.editReply({
		content: i18n.t("commands:report.tokensUsedRefused", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		})
	});
}

/**
 * Handle the response when player successfully buys heal
 * @param packet
 * @param context
 */
export async function handleBuyHealAccept(packet: CommandReportBuyHealAcceptPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = interaction.userLanguage;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.healSuccessTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.healSuccessDescription", {
			lng,
			price: packet.healPrice,
			nextStep: packet.isArrived
				? i18n.t("commands:report.healNextStepArrived", { lng })
				: i18n.t("commands:report.healNextStepSmallEvent", { lng })
		}));

	await buttonInteraction?.editReply({ embeds: [embed] });
}

/**
 * Handle the response when player refuses to buy heal
 * @param context
 */
export async function handleBuyHealRefuse(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = interaction.userLanguage;

	await buttonInteraction?.editReply({
		content: i18n.t("commands:report.healRefused", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		})
	});
}

/**
 * Handle the response when player has no alteration to heal
 * @param context
 */
export async function handleBuyHealNoAlteration(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = interaction.userLanguage;

	await buttonInteraction?.editReply({
		content: i18n.t("commands:report.healNoAlteration", { lng })
	});
}

/**
 * Handle the response when player tries to heal occupied alteration
 * @param context
 */
export async function handleBuyHealCannotHealOccupied(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = interaction.userLanguage;

	await buttonInteraction?.editReply({
		content: i18n.t("commands:report.healCannotHealOccupied", { lng })
	});
}

/**
 * Create the confirmation collector for buying heal
 * @param context
 * @param packet
 */
export async function createBuyHealCollector(context: PacketContext, packet: ReactionCollectorBuyHealPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const data = packet.data.data;

	return await createConfirmationCollector(context, packet, {
		titleKey: "commands:report.buyHealConfirmTitle",
		descriptionKey: "commands:report.buyHealConfirmDescription",
		descriptionParams: {
			price: data.healPrice,
			playerMoney: data.playerMoney
		}
	});
}

/**
 * Create the confirmation collector for using tokens
 * @param context
 * @param packet
 */
export async function createUseTokensCollector(context: PacketContext, packet: ReactionCollectorUseTokensPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const data = packet.data.data;

	return await createConfirmationCollector(context, packet, {
		titleKey: "commands:report.useTokensConfirmTitle",
		descriptionKey: "commands:report.useTokensConfirmDescription",
		descriptionParams: {
			count: data.cost,
			playerTokens: data.playerTokens
		}
	});
}

/**
 * Add optional energy and points fields to the travel embed
 */
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
			value: `${CrowniclesIcons.unitValues.score} ${packet.points.cumulated}`,
			inline: true
		});
	}
}

/**
 * Add a random advice field to the travel embed
 */
function addAdviceField(travelEmbed: CrowniclesEmbed, lng: Language): void {
	const advices = i18n.t("advices:advices", {
		returnObjects: true,
		lng
	});
	travelEmbed.addFields({
		name: i18n.t("commands:report.adviceTitle", { lng }),
		value: advices[Math.floor(Math.random() * advices.length)],
		inline: true
	});
}

/**
 * Generic button creation with currency check
 */
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

/**
 * Create heal button if applicable
 */
function createHealButton(packet: CommandReportTravelSummaryRes, lng: Language): ButtonBuilder | null {
	if (!packet.heal) {
		return null;
	}

	const hasEnoughMoney = packet.heal.playerMoney >= packet.heal.price;
	return createCurrencyButton({
		customId: "buyHeal",
		hasEnough: hasEnoughMoney,
		sufficientLabel: i18n.t("commands:report.buyHealButton", { lng }),
		insufficientLabel: i18n.t("commands:report.notEnoughMoneyHealButton", { lng }),
		emoji: CrowniclesIcons.shopItems.healAlteration,
		sufficientStyle: ButtonStyle.Success
	});
}

/**
 * Create token button if applicable
 */
function createTokenButton(packet: CommandReportTravelSummaryRes, lng: Language): ButtonBuilder | null {
	if (!packet.tokens) {
		return null;
	}

	const hasEnoughTokens = packet.tokens.playerTokens >= packet.tokens.cost;
	return createCurrencyButton({
		customId: "useTokens",
		hasEnough: hasEnoughTokens,
		sufficientLabel: i18n.t("commands:report.useTokensButton", { lng }),
		insufficientLabel: i18n.t("commands:report.notEnoughTokensButton", { lng }),
		emoji: CrowniclesIcons.unitValues.token,
		sufficientStyle: ButtonStyle.Primary
	});
}

/**
 * Build action row with heal and token buttons
 */
function buildTravelActionRow(packet: CommandReportTravelSummaryRes, lng: Language): ActionRowBuilder<ButtonBuilder> | null {
	const row = new ActionRowBuilder<ButtonBuilder>();

	const healButton = createHealButton(packet, lng);
	if (healButton) {
		row.addComponents(healButton);
	}

	const tokenButton = createTokenButton(packet, lng);
	if (tokenButton) {
		row.addComponents(tokenButton);
	}

	return row.components.length > 0 ? row : null;
}

/**
 * Check if any button is interactive (not disabled)
 */
function hasInteractiveButton(packet: CommandReportTravelSummaryRes): boolean {
	const tokensInteractive = packet.tokens && packet.tokens.playerTokens >= packet.tokens.cost;
	const healInteractive = packet.heal && packet.heal.playerMoney >= packet.heal.price;
	return Boolean(tokensInteractive || healInteractive);
}

/**
 * Handle button interaction in travel summary
 */
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

/**
 * Setup button collector for travel summary
 */
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

/**
 * Display the travel summary (embed with the travel path in between small events)
 * @param packet
 * @param context
 */
export async function reportTravelSummary(packet: CommandReportTravelSummaryRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;
	const now = Date.now();

	// Build embed
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

	// Build action row
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

export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("report"),
	getPacket,
	mainGuildCommand: false
};
