import i18n from "../../../translations/i18n";
import { CrowniclesEmbed } from "../../../messages/CrowniclesEmbed";
import { CrowniclesErrorEmbed } from "../../../messages/CrowniclesErrorEmbed";
import {
	escapeUsername, StringUtils
} from "../../../utils/StringUtils";
import { ExpeditionLocationType } from "../../../../../Lib/src/constants/ExpeditionConstants";
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
	packet: CommandPetExpeditionPacketRes
): CrowniclesEmbed {
	const lng = interaction.userLanguage;
	const sexContext = packet.pet ? getSexContext(packet.pet.petSex) : StringConstants.SEX.MALE.long;
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
	packet: CommandPetExpeditionPacketRes
): CrowniclesEmbed {
	const lng = interaction.userLanguage;
	const petDisplay = packet.pet
		? getPetDisplayString(packet.pet, lng)
		: i18n.t("commands:pet.defaultPetName", { lng });

	const sexContext = packet.pet ? getSexContext(packet.pet.petSex) : StringConstants.SEX.MALE.long;

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
	if (rewards.tokens && rewards.tokens > 0) {
		lines.push(i18n.t("commands:petExpedition.rewards.tokens", {
			lng,
			count: rewards.tokens
		}));
	}

	// Item is only given when itemGiven is true (not when pet was tired at start)
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
