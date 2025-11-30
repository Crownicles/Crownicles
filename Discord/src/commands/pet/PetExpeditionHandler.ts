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
	CommandPetExpeditionErrorPacket
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";
import {
	ButtonInteraction, StringSelectMenuInteraction
} from "discord.js";

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

	// Check if player has talisman - show RP message if not
	if (!packet.hasTalisman) {
		// Determine sex context - use pet sex if available, default to male
		const sexContext = packet.petSex ? getSexContext(packet.petSex as SexTypeShort) : StringConstants.SEX.MALE.long;
		const embed = new CrowniclesEmbed()
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

		await interaction.followUp({
			embeds: [embed]
		});
		return;
	}

	// Check if there's an expedition in progress that's complete (auto-resolve)
	if (packet.hasExpeditionInProgress && packet.expeditionInProgress) {
		const expedition = packet.expeditionInProgress;
		const now = Date.now();

		// Check if expedition is complete - redirect to resolve
		if (now >= expedition.endTime) {
			PacketUtils.sendPacketToBackend(context, makePacket(CommandPetExpeditionResolvePacketReq, {}));
			return;
		}

		/*
		 * If expedition is still in progress but we got this packet, it means
		 * the collector failed or wasn't created. This shouldn't happen in normal flow.
		 * But we can show an informational message
		 */
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
					risk: getTranslatedRiskCategoryName(expedition.riskRate, lng),
					returnTime: finishInTimeDisplay(new Date(expedition.endTime)),
					foodInfo
				})
			);

		await interaction.followUp({ embeds: [embed] });
		return;
	}

	// Check if player can't start an expedition (error cases)
	if (!packet.canStartExpedition) {
		const embed = new CrowniclesEmbed()
			.formatAuthor(
				i18n.t("commands:petExpedition.unavailableTitle", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}),
				interaction.user
			);

		// Get pet display with icon and name
		const petDisplay = packet.petId && packet.petSex
			? `${DisplayUtils.getPetIcon(packet.petId, packet.petSex as SexTypeShort)} **${DisplayUtils.getPetNicknameOrTypeName(packet.petNickname ?? null, packet.petId, packet.petSex as SexTypeShort, lng)}**`
			: i18n.t("commands:pet.defaultPetName", { lng });

		// Get sex context for gendered translations
		const sexContext = packet.petSex ? getSexContext(packet.petSex as SexTypeShort) : StringConstants.SEX.MALE.long;

		// Use RP messages for specific reasons
		if (packet.cannotStartReason === "noPet") {
			embed.setDescription(
				StringUtils.getRandomTranslation("commands:petExpedition.noPet", lng, {})
			);
		}
		else if (packet.cannotStartReason === "insufficientLove") {
			embed.setDescription(
				StringUtils.getRandomTranslation("commands:petExpedition.insufficientLove", lng, {
					context: sexContext,
					petDisplay,
					lovePoints: packet.petLovePoints ?? 0
				})
			);
		}
		else if (packet.cannotStartReason === "petHungry") {
			embed.setDescription(
				StringUtils.getRandomTranslation("commands:petExpedition.petHungry", lng, {
					context: sexContext,
					petDisplay
				})
			);
		}
		else {
			// Fallback for other reasons
			embed.setDescription(
				i18n.t(`commands:petExpedition.errors.${packet.cannotStartReason}`, { lng })
			);
		}

		embed.setErrorColor();

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
	const locationName = getExpeditionLocationName(
		lng,
		expedition.mapLocationId!,
		expedition.isDistantExpedition
	);
	const petDisplay = `${DisplayUtils.getPetIcon(expedition.petId, expedition.petSex as SexTypeShort)} **${DisplayUtils.getPetNicknameOrTypeName(expedition.petNickname ?? null, expedition.petId, expedition.petSex as SexTypeShort, lng)}**`;
	const sexContext = getSexContext(expedition.petSex as SexTypeShort);

	let description = i18n.t("commands:petExpedition.expeditionStarted", {
		lng,
		context: sexContext,
		petDisplay,
		location: `${locationEmoji} ${locationName}`,
		returnTime: finishInTimeDisplay(new Date(expedition.endTime))
	});

	if (packet.foodConsumed && packet.foodConsumed > 0) {
		description += i18n.t("commands:petExpedition.foodConsumed", {
			lng,
			amount: packet.foodConsumed
		});
	}

	if (packet.insufficientFood) {
		// Choose the right message depending on the cause (no guild / guild with no food)
		const cause = (packet as unknown as { insufficientFoodCause?: "noGuild" | "guildNoFood" }).insufficientFoodCause;
		if (cause === "guildNoFood") {
			description += i18n.t("commands:petExpedition.insufficientFoodWarning.guildNoFood", { lng });
		}
		else {
			description += i18n.t("commands:petExpedition.insufficientFoodWarning.noGuild", { lng });
		}
	}

	// Add speed modifier message based on pet speed impact
	if (packet.speedDurationModifier !== undefined) {
		let speedCategory: string;
		if (packet.speedDurationModifier < 0.80) {
			speedCategory = "veryFast";
		}
		else if (packet.speedDurationModifier < 0.95) {
			speedCategory = "fast";
		}
		else if (packet.speedDurationModifier <= 1.05) {
			speedCategory = "normal";
		}
		else if (packet.speedDurationModifier <= 1.15) {
			speedCategory = "slow";
		}
		else {
			speedCategory = "verySlow";
		}
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
 * Handle expedition cancellation
 */
export async function handleExpeditionCancelRes(
	context: PacketContext,
	packet: CommandPetExpeditionCancelPacketRes
): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;
	const petDisplay = `${DisplayUtils.getPetIcon(packet.petId, packet.petSex as SexTypeShort)} **${DisplayUtils.getPetNicknameOrTypeName(packet.petNickname ?? null, packet.petId, packet.petSex as SexTypeShort, lng)}**`;
	const sexContext = getSexContext(packet.petSex as SexTypeShort);

	const embed = new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:petExpedition.cancelledTitle", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(
			i18n.t("commands:petExpedition.cancelled", {
				lng,
				context: sexContext,
				petDisplay,
				loveLost: packet.loveLost
			})
		);

	await sendResponse(context, embed);
}

/**
 * Handle pet recall from expedition
 */
export async function handleExpeditionRecallRes(
	context: PacketContext,
	packet: CommandPetExpeditionRecallPacketRes
): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;
	const petDisplay = `${DisplayUtils.getPetIcon(packet.petId, packet.petSex as SexTypeShort)} **${DisplayUtils.getPetNicknameOrTypeName(packet.petNickname ?? null, packet.petId, packet.petSex as SexTypeShort, lng)}**`;
	const sexContext = getSexContext(packet.petSex as SexTypeShort);

	const embed = new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:petExpedition.recalledTitle", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}),
			interaction.user
		)
		.setDescription(
			i18n.t("commands:petExpedition.recalled", {
				lng,
				context: sexContext,
				petDisplay,
				loveLost: packet.loveLost
			})
		);

	await sendResponse(context, embed);
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
	const locationName = getExpeditionLocationName(
		lng,
		packet.expedition.mapLocationId!,
		packet.expedition.isDistantExpedition
	);
	const sexContext = getSexContext(packet.petSex as SexTypeShort);

	let description: string;
	let title: string;

	if (packet.totalFailure) {
		title = i18n.t("commands:petExpedition.failureTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		});
		description = StringUtils.getRandomTranslation("commands:petExpedition.totalFailure", lng, {
			context: sexContext,
			petDisplay,
			location: `${locationEmoji} ${locationName}`
		});
		description += i18n.t("commands:petExpedition.loveChangeFailure", { lng });
	}
	else if (packet.partialSuccess) {
		title = i18n.t("commands:petExpedition.partialSuccessTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		});
		description = StringUtils.getRandomTranslation("commands:petExpedition.partialSuccess", lng, {
			context: sexContext,
			petDisplay,
			location: `${locationEmoji} ${locationName}`
		});
		if (packet.rewards) {
			description += formatRewards(packet.rewards, lng);
		}
		description += i18n.t(packet.loveChange >= 0 ? "commands:petExpedition.loveChangePartialPositive" : "commands:petExpedition.loveChangePartialNegative", { lng });
	}
	else {
		title = i18n.t("commands:petExpedition.successTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		});
		description = StringUtils.getRandomTranslation("commands:petExpedition.success", lng, {
			context: sexContext,
			petDisplay,
			location: `${locationEmoji} ${locationName}`
		});
		if (packet.rewards) {
			description += formatRewards(packet.rewards, lng);
		}
		description += i18n.t("commands:petExpedition.loveChangeSuccess", { lng });
	}

	const embed = new CrowniclesEmbed()
		.formatAuthor(title, interaction.user)
		.setDescription(description);

	await interaction.followUp({ embeds: [embed] });
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
