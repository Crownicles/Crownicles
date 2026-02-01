import i18n from "../../../translations/i18n";
import { CrowniclesEmbed } from "../../../messages/CrowniclesEmbed";
import { CrowniclesErrorEmbed } from "../../../messages/CrowniclesErrorEmbed";
import {
	escapeUsername, StringUtils
} from "../../../utils/StringUtils";
import {
	ExpeditionLocationType, getPetExpeditionPreference, PetExpeditionPreferences
} from "../../../../../Lib/src/constants/ExpeditionConstants";
import { Language } from "../../../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../../../Lib/src/CrowniclesIcons";
import { StringConstants } from "../../../../../Lib/src/constants/StringConstants";
import {
	CommandPetExpeditionPacketRes,
	CommandPetExpeditionResolvePacketRes,
	ExpeditionRewardData
} from "../../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import { CrowniclesInteraction } from "../../../messages/CrowniclesInteraction";
import {
	getSexContext,
	getExpeditionLocationName,
	getPetDisplayString,
	buildInProgressDescription
} from "./ExpeditionDisplayUtils";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";

/**
 * Build error embed for missing talisman
 */
export function buildNoTalismanEmbed(
	interaction: CrowniclesInteraction,
	packet: CommandPetExpeditionPacketRes,
	context: PacketContext
): CrowniclesErrorEmbed {
	const lng = interaction.userLanguage;
	const sexContext = packet.pet ? getSexContext(packet.pet.petSex) : StringConstants.SEX.MALE.long;
	return new CrowniclesErrorEmbed(
		interaction.user,
		context,
		interaction,
		StringUtils.getRandomTranslation("commands:petExpedition.noTalisman", lng, { context: sexContext })
	);
}

/**
 * Build embed for expedition in progress
 */
export function buildInProgressEmbed(
	interaction: CrowniclesInteraction,
	expedition: NonNullable<CommandPetExpeditionPacketRes["expeditionInProgress"]>
): CrowniclesEmbed {
	const lng = interaction.userLanguage;
	const locationEmoji = CrowniclesIcons.expedition.locations[expedition.locationType as ExpeditionLocationType];
	const locationName = getExpeditionLocationName(lng, expedition.mapLocationId!, expedition.isDistantExpedition);
	const petDisplay = getPetDisplayString(expedition.pet, lng);
	const sexContext = getSexContext(expedition.pet.petSex);

	const description = buildInProgressDescription({
		lng,
		petDisplay,
		locationEmoji,
		locationName,
		riskRate: expedition.riskRate,
		returnTime: new Date(expedition.endTime),
		sexContext,
		foodConsumed: expedition.foodConsumed
	});

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
export function buildCannotStartEmbed(
	interaction: CrowniclesInteraction,
	packet: CommandPetExpeditionPacketRes,
	context: PacketContext
): CrowniclesErrorEmbed {
	const lng = interaction.userLanguage;
	const petDisplay = packet.pet
		? getPetDisplayString(packet.pet, lng)
		: i18n.t("commands:pet.defaultPetName", { lng });

	const sexContext = packet.pet ? getSexContext(packet.pet.petSex) : StringConstants.SEX.MALE.long;

	return new CrowniclesErrorEmbed(
		interaction.user,
		context,
		interaction,
		getCannotStartDescription(packet, lng, petDisplay, sexContext)
	);
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
 * Format rewards for display
 */
function formatRewards(
	rewards: ExpeditionRewardData,
	lng: Language,
	badgeEarned?: string,
	dislikedContext?: { sexContext: string }
): string {
	const lines: string[] = [i18n.t("commands:petExpedition.rewards.title", { lng })];

	// Show warning if pet disliked the expedition
	if (dislikedContext) {
		lines.push(i18n.t(`commands:petExpedition.rewards.dislikedExpedition.${dislikedContext.sexContext}`, { lng }));
	}

	// Add numeric rewards using a mapping approach
	const numericRewards = [
		{
			key: "money", value: rewards.money
		},
		{
			key: "experience", value: rewards.experience
		},
		{
			key: "points", value: rewards.points
		}
	];

	for (const {
		key, value
	} of numericRewards) {
		if (value > 0) {
			lines.push(i18n.t(`commands:petExpedition.rewards.${key}`, {
				lng, amount: value
			}));
		}
	}

	// Tokens have a different i18n key structure (count instead of amount)
	if (rewards.tokens && rewards.tokens > 0) {
		lines.push(i18n.t("commands:petExpedition.rewards.tokens", {
			lng, count: rewards.tokens
		}));
	}

	// Boolean rewards
	if (rewards.itemGiven) {
		lines.push(i18n.t("commands:petExpedition.rewards.item", { lng }));
	}
	if (rewards.cloneTalismanFound) {
		lines.push(i18n.t("commands:petExpedition.rewards.cloneTalisman", { lng }));
	}
	if (badgeEarned) {
		lines.push(i18n.t("commands:petExpedition.rewards.badgeEarned", { lng }));
	}

	return lines.join("\n");
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

	// Check if pet disliked the expedition for reward display
	const petPreference = getPetExpeditionPreference(packet.pet.petTypeId, packet.expedition.locationType);
	const dislikedContext = petPreference === PetExpeditionPreferences.DISLIKED ? { sexContext } : undefined;

	// Build liked expedition message if applicable
	const likedMessage = packet.petLikedExpedition && !packet.totalFailure
		? `\n${i18n.t("commands:petExpedition.petLikedExpedition", {
			lng,
			context: sexContext
		})}`
		: "";

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
		const rewardText = packet.rewards ? formatRewards(packet.rewards, lng, packet.badgeEarned, dislikedContext) : "";
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
			}) + rewardText + i18n.t(loveChangeKey, { lng }) + likedMessage
		};
	}

	const rewardText = packet.rewards ? formatRewards(packet.rewards, lng, packet.badgeEarned, dislikedContext) : "";
	return {
		title: i18n.t("commands:petExpedition.successTitle", {
			lng, pseudo
		}),
		description: StringUtils.getRandomTranslation("commands:petExpedition.success", lng, {
			context: sexContext,
			petDisplay,
			location
		}) + rewardText + i18n.t("commands:petExpedition.loveChangeSuccess", { lng }) + likedMessage
	};
}

/**
 * Build the expedition resolution embed
 */
export function buildExpeditionResolveEmbed(
	interaction: CrowniclesInteraction,
	packet: CommandPetExpeditionResolvePacketRes
): CrowniclesEmbed {
	const lng = interaction.userLanguage;
	const petDisplay = getPetDisplayString(packet.pet, lng);
	const locationEmoji = CrowniclesIcons.expedition.locations[packet.expedition.locationType as ExpeditionLocationType];
	const locationName = getExpeditionLocationName(lng, packet.expedition.mapLocationId!, packet.expedition.isDistantExpedition);

	const resolutionData = buildResolutionData(packet, {
		pseudo: escapeUsername(interaction.user.displayName),
		sexContext: getSexContext(packet.pet.petSex),
		petDisplay,
		location: `${locationEmoji} ${locationName}`,
		lng
	});

	return new CrowniclesEmbed()
		.formatAuthor(resolutionData.title, interaction.user)
		.setDescription(resolutionData.description);
}

/**
 * Build the expedition started embed
 */
export function buildExpeditionStartedEmbed(
	interaction: CrowniclesInteraction,
	description: string
): CrowniclesEmbed {
	const lng = interaction.userLanguage;
	return new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:petExpedition.startedTitle", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(description);
}

/**
 * Build expedition error embed
 */
export function buildExpeditionErrorEmbed(
	interaction: CrowniclesInteraction,
	errorCode: string,
	context: PacketContext
): CrowniclesErrorEmbed {
	const lng = interaction.userLanguage;
	return new CrowniclesErrorEmbed(
		interaction.user,
		context,
		interaction,
		i18n.t(`commands:petExpedition.errors.${errorCode}`, { lng })
	);
}
