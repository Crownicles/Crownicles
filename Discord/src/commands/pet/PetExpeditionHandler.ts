import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { PacketUtils } from "../../utils/PacketUtils";
import { escapeUsername } from "../../utils/StringUtils";
import { finishInTimeDisplay } from "../../../../Lib/src/utils/TimeUtils";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import {
	CommandPetExpeditionPacketRes,
	CommandPetExpeditionChoicePacketRes,
	CommandPetExpeditionCancelPacketRes,
	CommandPetExpeditionRecallPacketRes,
	CommandPetExpeditionResolvePacketReq,
	CommandPetExpeditionResolvePacketRes,
	CommandPetExpeditionErrorPacket
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import {
	ButtonInteraction, StringSelectMenuInteraction
} from "discord.js";
import { PetBasicInfo } from "../../../../Lib/src/types/PetBasicInfo";

// Import from new modules
import {
	getSexContext,
	getExpeditionLocationName,
	getPetDisplayString,
	getFoodConsumedDescription,
	getSpeedCategory
} from "./expedition/ExpeditionDisplayUtils";

import {
	buildNoTalismanEmbed,
	buildInProgressEmbed,
	buildCannotStartEmbed,
	buildExpeditionResolveEmbed,
	buildExpeditionStartedEmbed,
	buildExpeditionErrorEmbed
} from "./expedition/ExpeditionEmbedBuilders";

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
		const errorEmbed = buildExpeditionErrorEmbed(interaction, packet.failureReason!, context);
		await sendResponse(context, errorEmbed as unknown as CrowniclesEmbed);
		return;
	}

	const expedition = packet.expedition!;
	const locationEmoji = CrowniclesIcons.expedition.locations[expedition.locationType as ExpeditionLocationType];
	const locationName = getExpeditionLocationName(lng, expedition.mapLocationId!, expedition.isDistantExpedition);
	const petDisplay = getPetDisplayString(expedition.pet, lng);
	const sexContext = getSexContext(expedition.pet.petSex);

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

	// Add tired pet warning if applicable (pet started expedition while tired, only tokens will be rewarded)
	if (packet.wasStartedWhileTired) {
		description += i18n.t("commands:petExpedition.tiredPetWarning", {
			lng,
			context: sexContext
		});
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

	const embed = buildExpeditionStartedEmbed(interaction, description);
	await sendResponse(context, embed);
}

/**
 * Common packet structure for cancel/recall responses
 */
interface ExpeditionLoveLossPacket {
	pet: PetBasicInfo;
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

const EXPEDITION_FREE_CANCEL_KEYS: ExpeditionLoveLossKeys = {
	title: "commands:petExpedition.freeCancelledTitle",
	description: "commands:petExpedition.freeCancelled"
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
	const petDisplay = getPetDisplayString(packet.pet, lng);
	const sexContext = getSexContext(packet.pet.petSex);

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
	const keys = packet.isFreeCancellation ? EXPEDITION_FREE_CANCEL_KEYS : EXPEDITION_CANCEL_KEYS;
	await handleExpeditionLoveLossResponse(context, packet, keys);
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

	const embed = buildExpeditionResolveEmbed(interaction, packet);
	await sendResponse(context, embed);
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

	await interaction.followUp({
		embeds: [buildExpeditionErrorEmbed(interaction, packet.errorCode, context)],
		ephemeral: true
	});
}
