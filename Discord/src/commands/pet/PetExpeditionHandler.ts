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
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";
import { Language } from "../../../../Lib/src/Language";
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
	FoodConsumptionDetail
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
	const sexContext = packet.petSex ? getSexContext(packet.petSex as SexTypeShort) : StringConstants.SEX.MALE.long;
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
	const locationEmoji = ExpeditionConstants.getLocationEmoji(expedition.locationType as ExpeditionLocationType);
	const locationName = getExpeditionLocationName(lng, expedition.mapLocationId!, expedition.isDistantExpedition);
	const petDisplay = `${DisplayUtils.getPetIcon(expedition.petId, expedition.petSex as SexTypeShort)} **${DisplayUtils.getPetNicknameOrTypeName(expedition.petNickname ?? null, expedition.petId, expedition.petSex as SexTypeShort, lng)}**`;
	const sexContext = getSexContext(expedition.petSex as SexTypeShort);

	const foodInfo = expedition.foodConsumed && expedition.foodConsumed > 0
		? i18n.t("commands:petExpedition.inProgressFoodInfo", {
			lng,
			amount: expedition.foodConsumed
		})
		: "";

	return new CrowniclesEmbed()
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
				risk: getTranslatedRiskCategoryName(expedition.riskRate, lng),
				returnTime: finishInTimeDisplay(new Date(expedition.endTime)),
				foodInfo
			})
		);
}

/**
 * Get description for cannot start expedition reasons
 */
function getCannotStartDescription(
	packet: CommandPetExpeditionPacketRes,
	lng: Language,
	petDisplay: string,
	sexContext: string
): string {
	switch (packet.cannotStartReason) {
		case "noPet":
			return StringUtils.getRandomTranslation("commands:petExpedition.noPet", lng, {});
		case "insufficientLove":
			return StringUtils.getRandomTranslation("commands:petExpedition.insufficientLove", lng, {
				context: sexContext,
				petDisplay,
				lovePoints: packet.petLovePoints ?? 0
			});
		case "petHungry":
			return StringUtils.getRandomTranslation("commands:petExpedition.petHungry", lng, {
				context: sexContext,
				petDisplay
			});
		default:
			return i18n.t(`commands:petExpedition.errors.${packet.cannotStartReason}`, { lng });
	}
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

	const lng = interaction.userLanguage;

	// Check if player has talisman
	if (!packet.hasTalisman) {
		await interaction.followUp({
			embeds: [buildNoTalismanEmbed(interaction, packet)]
		});
		return;
	}

	// Check if there's an expedition in progress that's complete (auto-resolve)
	if (packet.hasExpeditionInProgress && packet.expeditionInProgress) {
		const expedition = packet.expeditionInProgress;

		// Check if expedition is complete - redirect to resolve
		if (Date.now() >= expedition.endTime) {
			PacketUtils.sendPacketToBackend(context, makePacket(CommandPetExpeditionResolvePacketReq, {}));
			return;
		}

		await interaction.followUp({ embeds: [buildInProgressEmbed(interaction, expedition)] });
		return;
	}

	// Check if player can't start an expedition (error cases)
	if (!packet.canStartExpedition) {
		// Get pet display with icon and name
		const petDisplay = packet.petId && packet.petSex
			? `${DisplayUtils.getPetIcon(packet.petId, packet.petSex as SexTypeShort)} **${DisplayUtils.getPetNicknameOrTypeName(packet.petNickname ?? null, packet.petId, packet.petSex as SexTypeShort, lng)}**`
			: i18n.t("commands:pet.defaultPetName", { lng });

		const sexContext = packet.petSex ? getSexContext(packet.petSex as SexTypeShort) : StringConstants.SEX.MALE.long;

		const embed = new CrowniclesEmbed()
			.formatAuthor(
				i18n.t("commands:petExpedition.unavailableTitle", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}),
				interaction.user
			)
			.setDescription(getCannotStartDescription(packet, lng, petDisplay, sexContext))
			.setErrorColor();

		await interaction.followUp({
			embeds: [embed]
		});
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
 * Get speed category based on duration modifier
 */
function getSpeedCategory(speedDurationModifier: number): string {
	if (speedDurationModifier < 0.80) {
		return "veryFast";
	}
	if (speedDurationModifier < 0.95) {
		return "fast";
	}
	if (speedDurationModifier <= 1.05) {
		return "normal";
	}
	if (speedDurationModifier <= 1.15) {
		return "slow";
	}
	return "verySlow";
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
	const locationEmoji = ExpeditionConstants.getLocationEmoji(expedition.locationType as ExpeditionLocationType);
	const locationName = getExpeditionLocationName(lng, expedition.mapLocationId!, expedition.isDistantExpedition);
	const petDisplay = `${DisplayUtils.getPetIcon(expedition.petId, expedition.petSex as SexTypeShort)} **${DisplayUtils.getPetNicknameOrTypeName(expedition.petNickname ?? null, expedition.petId, expedition.petSex as SexTypeShort, lng)}**`;
	const sexContext = getSexContext(expedition.petSex as SexTypeShort);

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
		const cause = (packet as unknown as { insufficientFoodCause?: "noGuild" | "guildNoFood" }).insufficientFoodCause;
		const warningKey = cause === "guildNoFood" ? "guildNoFood" : "noGuild";
		description += i18n.t(`commands:petExpedition.insufficientFoodWarning.${warningKey}`, { lng });
	}

	// Add speed modifier message
	if (packet.speedDurationModifier !== undefined) {
		const speedCategory = getSpeedCategory(packet.speedDurationModifier);
		description += i18n.t(`commands:petExpedition.speedModifier.${speedCategory}`, {
			lng,
			context: sexContext
		});
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
	petSex: string;
	petNickname?: string;
	loveLost: number;
}

/**
 * Build an embed for expedition cancellation or recall
 */
function buildExpeditionLoveLossEmbed(
	context: PacketContext,
	packet: ExpeditionLoveLossPacket,
	titleKey: string,
	descriptionKey: string
): CrowniclesEmbed | null {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return null;
	}

	const lng = interaction.userLanguage;
	const petDisplay = `${DisplayUtils.getPetIcon(packet.petId, packet.petSex as SexTypeShort)} **${DisplayUtils.getPetNicknameOrTypeName(packet.petNickname ?? null, packet.petId, packet.petSex as SexTypeShort, lng)}**`;
	const sexContext = getSexContext(packet.petSex as SexTypeShort);

	return new CrowniclesEmbed()
		.formatAuthor(
			i18n.t(titleKey, {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(
			i18n.t(descriptionKey, {
				lng,
				context: sexContext,
				petDisplay,
				loveLost: packet.loveLost
			})
		);
}

/**
 * Handle expedition cancellation
 */
export async function handleExpeditionCancelRes(
	context: PacketContext,
	packet: CommandPetExpeditionCancelPacketRes
): Promise<void> {
	const embed = buildExpeditionLoveLossEmbed(
		context,
		packet,
		"commands:petExpedition.cancelledTitle",
		"commands:petExpedition.cancelled"
	);
	if (embed) {
		await sendResponse(context, embed);
	}
}

/**
 * Handle pet recall from expedition
 */
export async function handleExpeditionRecallRes(
	context: PacketContext,
	packet: CommandPetExpeditionRecallPacketRes
): Promise<void> {
	const embed = buildExpeditionLoveLossEmbed(
		context,
		packet,
		"commands:petExpedition.recalledTitle",
		"commands:petExpedition.recalled"
	);
	if (embed) {
		await sendResponse(context, embed);
	}
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
): { title: string; description: string } {
	const {
		pseudo, sexContext, petDisplay, location, lng
	} = ctx;

	if (packet.totalFailure) {
		return {
			title: i18n.t("commands:petExpedition.failureTitle", { lng, pseudo }),
			description: StringUtils.getRandomTranslation("commands:petExpedition.totalFailure", lng, {
				context: sexContext,
				petDisplay,
				location
			}) + i18n.t("commands:petExpedition.loveChangeFailure", { lng })
		};
	}

	if (packet.partialSuccess) {
		const rewardText = packet.rewards ? formatRewards(packet.rewards, lng) : "";
		const loveChangeKey = packet.loveChange >= 0
			? "commands:petExpedition.loveChangePartialPositive"
			: "commands:petExpedition.loveChangePartialNegative";
		return {
			title: i18n.t("commands:petExpedition.partialSuccessTitle", { lng, pseudo }),
			description: StringUtils.getRandomTranslation("commands:petExpedition.partialSuccess", lng, {
				context: sexContext,
				petDisplay,
				location
			}) + rewardText + i18n.t(loveChangeKey, { lng })
		};
	}

	const rewardText = packet.rewards ? formatRewards(packet.rewards, lng) : "";
	return {
		title: i18n.t("commands:petExpedition.successTitle", { lng, pseudo }),
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
	const petDisplay = `${DisplayUtils.getPetIcon(packet.petId, packet.petSex as SexTypeShort)} **${DisplayUtils.getPetNicknameOrTypeName(packet.petNickname ?? null, packet.petId, packet.petSex as SexTypeShort, lng)}**`;
	const locationEmoji = ExpeditionConstants.getLocationEmoji(packet.expedition.locationType as ExpeditionLocationType);
	const locationName = getExpeditionLocationName(lng, packet.expedition.mapLocationId!, packet.expedition.isDistantExpedition);

	const resolutionData = buildResolutionData(packet, {
		pseudo: escapeUsername(interaction.user.displayName),
		sexContext: getSexContext(packet.petSex as SexTypeShort),
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
	rewards: {
		money: number;
		gems: number;
		experience: number;
		guildExperience: number;
		points: number;
		cloneTalismanFound?: boolean;
	},
	lng: Language
): string {
	const lines: string[] = [i18n.t("commands:petExpedition.rewards.title", { lng })];

	if (rewards.money > 0) {
		lines.push(i18n.t("commands:petExpedition.rewards.money", {
			lng,
			amount: rewards.money
		}));
	}
	if (rewards.gems > 0) {
		lines.push(i18n.t("commands:petExpedition.rewards.gems", {
			lng,
			amount: rewards.gems
		}));
	}
	if (rewards.experience > 0) {
		lines.push(i18n.t("commands:petExpedition.rewards.experience", {
			lng,
			amount: rewards.experience
		}));
	}
	if (rewards.guildExperience > 0) {
		lines.push(i18n.t("commands:petExpedition.rewards.guildExperience", {
			lng,
			amount: rewards.guildExperience
		}));
	}
	if (rewards.points > 0) {
		lines.push(i18n.t("commands:petExpedition.rewards.points", {
			lng,
			amount: rewards.points
		}));
	}
	if (rewards.cloneTalismanFound) {
		lines.push(i18n.t("commands:petExpedition.rewards.cloneTalisman", { lng }));
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
