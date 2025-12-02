import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import { PacketUtils } from "../../utils/PacketUtils";
import {
	escapeUsername, StringUtils
} from "../../utils/StringUtils";
import { finishInTimeDisplay } from "../../../../Lib/src/utils/TimeUtils";
import {
	ExpeditionConstants, ExpeditionLocationType, SpeedCategory
} from "../../../../Lib/src/constants/ExpeditionConstants";
import { Language } from "../../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { DisplayUtils } from "../../utils/DisplayUtils";
import {
	SexTypeShort, StringConstants
} from "../../../../Lib/src/constants/StringConstants";
import {
	CommandPetExpeditionPacketRes,
	CommandPetExpeditionChoicePacketRes,
	CommandPetExpeditionCancelPacketRes,
	CommandPetExpeditionRecallPacketRes,
	CommandPetExpeditionResolvePacketReq,
	CommandPetExpeditionResolvePacketRes,
	CommandPetExpeditionErrorPacket,
	FoodConsumptionDetail,
	ExpeditionRewardData
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import {
	ButtonInteraction, StringSelectMenuInteraction
} from "discord.js";
import { CrowniclesInteraction } from "../../messages/CrowniclesInteraction";

/**
 * Format food consumption details for display
 * Returns a string like: "{emote} Friandise: 2 | {emote} Viande: 1"
 */
export function formatFoodConsumedDetails(details: FoodConsumptionDetail[], lng: Language): string {
	if (!details || details.length === 0) {
		return "";
	}

	return details.map(detail => {
		const foodName = i18n.t(`models:foods.${detail.foodType}`, {
			lng,
			count: detail.amount,
			context: "capitalized"
		});
		return `{emote:foods.${detail.foodType}} ${foodName}: ${detail.amount}`;
	}).join(" | ");
}

/**
 * Get the sex context string for i18n translations (male/female)
 */
function getSexContext(sex: SexTypeShort): string {
	return sex === StringConstants.SEX.MALE.short ? StringConstants.SEX.MALE.long : StringConstants.SEX.FEMALE.long;
}

/**
 * Helper to send response using the correct interaction (button/select menu or original)
 */
async function sendResponse(
	context: PacketContext,
	embed: CrowniclesEmbed
): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}

	// Check if we have a button or select menu interaction from a collector
	const buttonInteraction = context.discord?.buttonInteraction
		? DiscordCache.getButtonInteraction(context.discord.buttonInteraction) as ButtonInteraction | undefined
		: undefined;
	const selectMenuInteraction = context.discord?.stringSelectMenuInteraction
		? DiscordCache.getStringSelectMenuInteraction(context.discord.stringSelectMenuInteraction) as StringSelectMenuInteraction | undefined
		: undefined;

	const componentInteraction = buttonInteraction ?? selectMenuInteraction;

	if (componentInteraction && !componentInteraction.replied) {
		await componentInteraction.editReply({ embeds: [embed] });
	}
	else {
		await interaction.channel.send({ embeds: [embed] });
	}
}

/**
 * Get translated risk category name for display
 */
function getTranslatedRiskCategoryName(riskRate: number, lng: Language): string {
	const categoryKey = ExpeditionConstants.getRiskCategoryName(riskRate);
	return i18n.t(`commands:petExpedition.riskCategories.${categoryKey}`, { lng });
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
 * Build error embed for missing talisman
 */
function buildNoTalismanEmbed(
	interaction: CrowniclesInteraction,
	packet: CommandPetExpeditionPacketRes
): CrowniclesEmbed {
	const lng = interaction.userLanguage;
	const sexContext = packet.petSex ? getSexContext(packet.petSex) : StringConstants.SEX.MALE.long;
	return new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:petExpedition.unavailableTitle", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(
			StringUtils.getRandomTranslation("commands:petExpedition.noTalisman", lng, { context: sexContext })
		)
		.setErrorColor();
}

/**
 * Build embed for expedition in progress
 */
function buildInProgressEmbed(
	interaction: CrowniclesInteraction,
	expedition: NonNullable<CommandPetExpeditionPacketRes["expeditionInProgress"]>
): CrowniclesEmbed {
	const lng = interaction.userLanguage;
	const locationEmoji = CrowniclesIcons.expedition.locations[expedition.locationType as ExpeditionLocationType];
	const locationName = getExpeditionLocationName(lng, expedition.mapLocationId!, expedition.isDistantExpedition);
	const petDisplay = `${DisplayUtils.getPetIcon(expedition.petId, expedition.petSex)} **${DisplayUtils.getPetNicknameOrTypeName(expedition.petNickname, expedition.petId, expedition.petSex, lng)}**`;
	const sexContext = getSexContext(expedition.petSex);

	const foodInfo = expedition.foodConsumed && expedition.foodConsumed > 0
		? i18n.t("commands:petExpedition.inProgressFoodInfo", {
			lng,
			amount: expedition.foodConsumed
		})
		: "";

	// Build description using nested translations
	const intro = i18n.t("commands:petExpedition.inProgressDescription.intro", {
		lng, petDisplay
	});
	const destination = i18n.t("commands:petExpedition.inProgressDescription.destination", {
		lng,
		location: `${locationEmoji} ${locationName}`
	});
	const risk = i18n.t("commands:petExpedition.inProgressDescription.risk", {
		lng,
		risk: getTranslatedRiskCategoryName(expedition.riskRate, lng)
	});
	const returnTime = i18n.t("commands:petExpedition.inProgressDescription.returnTime", {
		lng,
		returnTime: finishInTimeDisplay(new Date(expedition.endTime))
	});
	const warning = i18n.t("commands:petExpedition.inProgressDescription.warning", {
		lng,
		context: sexContext
	});

	const description = `${intro}\n\n${destination}\n${risk}\n${returnTime}${foodInfo}\n\n${warning}`;

	return new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:petExpedition.inProgressTitle", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(description);
}

/**
 * Keys that use random translations with context and pet display
 */
const CANNOT_START_RANDOM_KEYS = [
	"noPet",
	"petHungry"
] as const;

/**
 * Get description for cannot start expedition reasons
 */
function getCannotStartDescription(
	packet: CommandPetExpeditionPacketRes,
	lng: Language,
	petDisplay: string,
	sexContext: string
): string {
	const reason = packet.cannotStartReason;

	// Special handling for insufficientLove - combine main text with advice
	if (reason === "insufficientLove") {
		const mainText = StringUtils.getRandomTranslation(`commands:petExpedition.${reason}`, lng, {
			context: sexContext,
			petDisplay,
			lovePoints: packet.petLovePoints ?? 0
		});
		const adviceText = StringUtils.getRandomTranslation("commands:petExpedition.insufficientLoveAdvice", lng, {
			context: sexContext
		});
		return `${mainText}\n\n${adviceText}`;
	}

	if (reason && CANNOT_START_RANDOM_KEYS.includes(reason as typeof CANNOT_START_RANDOM_KEYS[number])) {
		return StringUtils.getRandomTranslation(`commands:petExpedition.${reason}`, lng, {
			context: sexContext,
			petDisplay,
			lovePoints: packet.petLovePoints ?? 0
		});
	}

	return i18n.t(`commands:petExpedition.errors.${reason}`, { lng });
}

/**
 * Build error embed for cannot start expedition scenarios
 */
function buildCannotStartEmbed(
	interaction: CrowniclesInteraction,
	packet: CommandPetExpeditionPacketRes
): CrowniclesEmbed {
	const lng = interaction.userLanguage;
	const petDisplay = packet.petId && packet.petSex
		? `${DisplayUtils.getPetIcon(packet.petId, packet.petSex)} **${DisplayUtils.getPetNicknameOrTypeName(packet.petNickname, packet.petId, packet.petSex, lng)}**`
		: i18n.t("commands:pet.defaultPetName", { lng });

	const sexContext = packet.petSex ? getSexContext(packet.petSex) : StringConstants.SEX.MALE.long;

	return new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:petExpedition.unavailableTitle", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(getCannotStartDescription(packet, lng, petDisplay, sexContext))
		.setErrorColor();
}

/**
 * Handle the initial expedition status response
 * This only handles error cases and auto-resolve redirect.
 * Collector creation is now handled via ReactionCollectorCreationPacket.
 */
export async function handleExpeditionStatusRes(
	context: PacketContext,
	packet: CommandPetExpeditionPacketRes
): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}

	// Check if player has talisman
	if (!packet.hasTalisman) {
		await interaction.followUp({ embeds: [buildNoTalismanEmbed(interaction, packet)] });
		return;
	}

	// Check if there's an expedition in progress
	if (packet.hasExpeditionInProgress && packet.expeditionInProgress) {
		// Auto-resolve if expedition is complete
		if (Date.now() >= packet.expeditionInProgress.endTime) {
			PacketUtils.sendPacketToBackend(context, makePacket(CommandPetExpeditionResolvePacketReq, {}));
			return;
		}
		await interaction.followUp({ embeds: [buildInProgressEmbed(interaction, packet.expeditionInProgress)] });
		return;
	}

	// Check if player can't start an expedition (error cases)
	if (!packet.canStartExpedition) {
		await interaction.followUp({ embeds: [buildCannotStartEmbed(interaction, packet)] });
	}

	/*
	 * If canStartExpedition is true, Core should have sent a ReactionCollectorCreationPacket
	 * So we don't need to do anything here
	 */
}

/**
 * Get food consumption description
 */
function getFoodConsumedDescription(packet: CommandPetExpeditionChoicePacketRes, lng: Language): string {
	if (packet.foodConsumedDetails && packet.foodConsumedDetails.length > 0) {
		const foodDetailsDisplay = formatFoodConsumedDetails(packet.foodConsumedDetails, lng);
		return i18n.t("commands:petExpedition.foodConsumedDetails", {
			lng,
			foodDetails: foodDetailsDisplay
		});
	}
	if (packet.foodConsumed && packet.foodConsumed > 0) {
		return i18n.t("commands:petExpedition.foodConsumed", {
			lng,
			amount: packet.foodConsumed
		});
	}
	return "";
}

/**
 * Get speed category based on actual final duration vs displayed duration
 * @param actualDurationMinutes - The real duration after speed modifier
 * @param displayedDurationMinutes - The duration shown to the user (rounded to 10 min)
 */
function getSpeedCategory(actualDurationMinutes: number, displayedDurationMinutes: number): SpeedCategory {
	// Calculate ratio: how much faster/slower compared to what was displayed
	const ratio = actualDurationMinutes / displayedDurationMinutes;

	if (ratio < 0.70) {
		return ExpeditionConstants.SPEED_CATEGORIES.VERY_FAST;
	}
	if (ratio < 0.90) {
		return ExpeditionConstants.SPEED_CATEGORIES.FAST;
	}

	/*
	 * If actual duration is close to or above displayed duration, it's "normal" (no message)
	 * Since displayed duration is already rounded up, being at or below it is expected
	 */
	if (ratio <= 1.0) {
		return ExpeditionConstants.SPEED_CATEGORIES.NORMAL;
	}
	if (ratio <= 1.15) {
		return ExpeditionConstants.SPEED_CATEGORIES.SLOW;
	}
	return ExpeditionConstants.SPEED_CATEGORIES.VERY_SLOW;
}

/**
 * Handle expedition choice confirmation
 */
export async function handleExpeditionChoiceRes(
	context: PacketContext,
	packet: CommandPetExpeditionChoicePacketRes
): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;

	if (!packet.success) {
		const errorEmbed = new CrowniclesErrorEmbed(
			interaction.user,
			context,
			interaction,
			i18n.t(`commands:petExpedition.errors.${packet.failureReason}`, { lng })
		);
		await sendResponse(context, errorEmbed as CrowniclesEmbed);
		return;
	}

	const expedition = packet.expedition!;
	const locationEmoji = CrowniclesIcons.expedition.locations[expedition.locationType as ExpeditionLocationType];
	const locationName = getExpeditionLocationName(lng, expedition.mapLocationId!, expedition.isDistantExpedition);
	const petDisplay = `${DisplayUtils.getPetIcon(expedition.petId, expedition.petSex)} **${DisplayUtils.getPetNicknameOrTypeName(expedition.petNickname, expedition.petId, expedition.petSex, lng)}**`;
	const sexContext = getSexContext(expedition.petSex);

	let description = i18n.t("commands:petExpedition.expeditionStarted", {
		lng,
		context: sexContext,
		petDisplay,
		location: `${locationEmoji} ${locationName}`,
		returnTime: finishInTimeDisplay(new Date(expedition.endTime))
	});

	// Add food consumption details
	description += getFoodConsumedDescription(packet, lng);

	// Add insufficient food warning if applicable
	if (packet.insufficientFood) {
		const warningKey = packet.insufficientFoodCause === "guildNoFood" ? "guildNoFood" : "noGuild";
		description += i18n.t(`commands:petExpedition.insufficientFoodWarning.${warningKey}`, { lng });
	}

	// Add speed modifier message (only if actual time differs significantly from displayed time)
	if (packet.expedition && packet.originalDisplayDurationMinutes) {
		const actualDuration = packet.expedition.durationMinutes;
		const displayedDuration = packet.originalDisplayDurationMinutes;
		const speedCategory = getSpeedCategory(actualDuration, displayedDuration);
		if (speedCategory !== ExpeditionConstants.SPEED_CATEGORIES.NORMAL) {
			description += i18n.t(`commands:petExpedition.speedModifier.${speedCategory}`, {
				lng,
				context: sexContext
			});
		}
	}

	const embed = new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:petExpedition.startedTitle", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(description);

	await sendResponse(context, embed);
}

/**
 * Common packet structure for cancel/recall responses
 */
interface ExpeditionLoveLossPacket {
	petId: number;
	petSex: SexTypeShort;
	petNickname?: string;
	loveLost: number;
}

/**
 * Translation keys for expedition love loss responses
 */
interface ExpeditionLoveLossKeys {
	title: string;
	description: string;
}

const EXPEDITION_CANCEL_KEYS: ExpeditionLoveLossKeys = {
	title: "commands:petExpedition.cancelledTitle",
	description: "commands:petExpedition.cancelled"
};

const EXPEDITION_RECALL_KEYS: ExpeditionLoveLossKeys = {
	title: "commands:petExpedition.recalledTitle",
	description: "commands:petExpedition.recalled"
};

/**
 * Build and send an embed for expedition cancellation or recall
 */
async function handleExpeditionLoveLossResponse(
	context: PacketContext,
	packet: ExpeditionLoveLossPacket,
	keys: ExpeditionLoveLossKeys
): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;
	const petDisplay = `${DisplayUtils.getPetIcon(packet.petId, packet.petSex)} **${DisplayUtils.getPetNicknameOrTypeName(packet.petNickname, packet.petId, packet.petSex, lng)}**`;
	const sexContext = getSexContext(packet.petSex);

	const embed = new CrowniclesEmbed()
		.formatAuthor(
			i18n.t(keys.title, {
				lng, pseudo: escapeUsername(interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(
			i18n.t(keys.description, {
				lng, context: sexContext, petDisplay, loveLost: packet.loveLost
			})
		);

	await sendResponse(context, embed);
}

/**
 * Handle expedition cancellation
 */
export async function handleExpeditionCancelRes(
	context: PacketContext,
	packet: CommandPetExpeditionCancelPacketRes
): Promise<void> {
	await handleExpeditionLoveLossResponse(context, packet, EXPEDITION_CANCEL_KEYS);
}

/**
 * Handle pet recall from expedition
 */
export async function handleExpeditionRecallRes(
	context: PacketContext,
	packet: CommandPetExpeditionRecallPacketRes
): Promise<void> {
	await handleExpeditionLoveLossResponse(context, packet, EXPEDITION_RECALL_KEYS);
}

/**
 * Expedition resolution display context
 */
interface ExpeditionResolutionContext {
	pseudo: string;
	sexContext: string;
	petDisplay: string;
	location: string;
	lng: Language;
}

/**
 * Build resolution data based on expedition outcome
 */
function buildResolutionData(
	packet: CommandPetExpeditionResolvePacketRes,
	ctx: ExpeditionResolutionContext
): {
	title: string; description: string;
} {
	const {
		pseudo, sexContext, petDisplay, location, lng
	} = ctx;

	if (packet.totalFailure) {
		return {
			title: i18n.t("commands:petExpedition.failureTitle", {
				lng, pseudo
			}),
			description: StringUtils.getRandomTranslation("commands:petExpedition.totalFailure", lng, {
				context: sexContext,
				petDisplay,
				location
			}) + i18n.t("commands:petExpedition.loveChangeFailure", { lng })
		};
	}

	if (packet.partialSuccess) {
		const rewardText = packet.rewards ? formatRewards(packet.rewards, lng, packet.badgeEarned) : "";
		const loveChangeKey = packet.loveChange >= 0
			? "commands:petExpedition.loveChangePartialPositive"
			: "commands:petExpedition.loveChangePartialNegative";
		return {
			title: i18n.t("commands:petExpedition.partialSuccessTitle", {
				lng, pseudo
			}),
			description: StringUtils.getRandomTranslation("commands:petExpedition.partialSuccess", lng, {
				context: sexContext,
				petDisplay,
				location
			}) + rewardText + i18n.t(loveChangeKey, { lng })
		};
	}

	const rewardText = packet.rewards ? formatRewards(packet.rewards, lng, packet.badgeEarned) : "";
	return {
		title: i18n.t("commands:petExpedition.successTitle", {
			lng, pseudo
		}),
		description: StringUtils.getRandomTranslation("commands:petExpedition.success", lng, {
			context: sexContext,
			petDisplay,
			location
		}) + rewardText + i18n.t("commands:petExpedition.loveChangeSuccess", { lng })
	};
}

/**
 * Handle expedition resolution (success/failure)
 */
export async function handleExpeditionResolveRes(
	context: PacketContext,
	packet: CommandPetExpeditionResolvePacketRes
): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;
	const petDisplay = `${DisplayUtils.getPetIcon(packet.petId, packet.petSex)} **${DisplayUtils.getPetNicknameOrTypeName(packet.petNickname, packet.petId, packet.petSex, lng)}**`;
	const locationEmoji = CrowniclesIcons.expedition.locations[packet.expedition.locationType as ExpeditionLocationType];
	const locationName = getExpeditionLocationName(lng, packet.expedition.mapLocationId!, packet.expedition.isDistantExpedition);

	const resolutionData = buildResolutionData(packet, {
		pseudo: escapeUsername(interaction.user.displayName),
		sexContext: getSexContext(packet.petSex),
		petDisplay,
		location: `${locationEmoji} ${locationName}`,
		lng
	});

	const embed = new CrowniclesEmbed()
		.formatAuthor(resolutionData.title, interaction.user)
		.setDescription(resolutionData.description);

	await sendResponse(context, embed);
}

/**
 * Format rewards for display
 */
function formatRewards(
	rewards: ExpeditionRewardData,
	lng: Language,
	badgeEarned?: string
): string {
	const lines: string[] = [i18n.t("commands:petExpedition.rewards.title", { lng })];

	if (rewards.money > 0) {
		lines.push(i18n.t("commands:petExpedition.rewards.money", {
			lng,
			amount: rewards.money
		}));
	}
	if (rewards.experience > 0) {
		lines.push(i18n.t("commands:petExpedition.rewards.experience", {
			lng,
			amount: rewards.experience
		}));
	}
	if (rewards.points > 0) {
		lines.push(i18n.t("commands:petExpedition.rewards.points", {
			lng,
			amount: rewards.points
		}));
	}

	// Item is always given on successful expeditions (shown in separate embed via giveItemToPlayer)
	lines.push(i18n.t("commands:petExpedition.rewards.item", { lng }));
	if (rewards.cloneTalismanFound) {
		lines.push(i18n.t("commands:petExpedition.rewards.cloneTalisman", { lng }));
	}
	if (badgeEarned) {
		lines.push(i18n.t("commands:petExpedition.rewards.badgeEarned", { lng }));
	}

	return lines.join("\n");
}

/**
 * Handle expedition errors
 */
export async function handleExpeditionError(
	context: PacketContext,
	packet: CommandPetExpeditionErrorPacket
): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;

	await interaction.followUp({
		embeds: [
			new CrowniclesErrorEmbed(
				interaction.user,
				context,
				interaction,
				i18n.t(`commands:petExpedition.errors.${packet.errorCode}`, { lng })
			)
		],
		ephemeral: true
	});
}
