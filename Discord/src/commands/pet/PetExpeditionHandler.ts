import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import i18n from "../../translations/i18n";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import { CrowniclesErrorEmbed } from "../../messages/CrowniclesErrorEmbed";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction
} from "discord.js";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { sendInteractionNotForYou } from "../../utils/ErrorUtils";
import { PacketUtils } from "../../utils/PacketUtils";
import {
	escapeUsername, StringUtils
} from "../../utils/StringUtils";
import { finishInTimeDisplay } from "../../../../Lib/src/utils/TimeUtils";
import {
	ExpeditionConstants, ExpeditionLocationType
} from "../../../../Lib/src/constants/ExpeditionConstants";
import { Language } from "../../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { DisplayUtils } from "../../utils/DisplayUtils";
import {
	SexTypeShort, StringConstants
} from "../../../../Lib/src/constants/StringConstants";
import {
	CommandPetExpeditionPacketRes,
	CommandPetExpeditionGeneratePacketReq,
	CommandPetExpeditionGeneratePacketRes,
	CommandPetExpeditionChoicePacketReq,
	CommandPetExpeditionChoicePacketRes,
	CommandPetExpeditionCancelPacketReq,
	CommandPetExpeditionCancelPacketRes,
	CommandPetExpeditionRecallPacketReq,
	CommandPetExpeditionRecallPacketRes,
	CommandPetExpeditionResolvePacketReq,
	CommandPetExpeditionResolvePacketRes,
	CommandPetExpeditionErrorPacket
} from "../../../../Lib/src/packets/commands/CommandPetExpeditionPacket";

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
 * Format duration for display
 */
function formatDuration(minutes: number, lng: Language): string {
	const minutesPerHour = ExpeditionConstants.TIME.MINUTES_PER_HOUR;
	const hoursPerDay = ExpeditionConstants.TIME.HOURS_PER_DAY;
	const minutesPerDay = minutesPerHour * hoursPerDay;

	// Less than 1 hour: show only minutes
	if (minutes < minutesPerHour) {
		return i18n.t("commands:petExpedition.duration.minutes", {
			lng,
			count: minutes
		});
	}

	// Less than 1 day: show hours and optionally minutes
	if (minutes < minutesPerDay) {
		const hours = Math.floor(minutes / minutesPerHour);
		const remainingMinutes = minutes % minutesPerHour;
		if (remainingMinutes === 0) {
			return i18n.t("commands:petExpedition.duration.hours", {
				lng,
				count: hours
			});
		}
		return i18n.t("commands:petExpedition.duration.hoursMinutes", {
			lng,
			hours,
			minutes: remainingMinutes
		});
	}

	// 1 day or more: show days and optionally hours
	const days = Math.floor(minutes / minutesPerDay);
	const remainingMinutes = minutes % minutesPerDay;
	const remainingHours = Math.floor(remainingMinutes / minutesPerHour);

	if (remainingHours === 0) {
		return i18n.t("commands:petExpedition.duration.days", {
			lng,
			count: days
		});
	}
	return i18n.t("commands:petExpedition.duration.daysHours", {
		lng,
		days,
		hours: remainingHours
	});
}

/**
 * Handle the initial expedition status response
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

	// Check if there's an expedition in progress
	if (packet.hasExpeditionInProgress && packet.expeditionInProgress) {
		const expedition = packet.expeditionInProgress;
		const endTime = new Date(expedition.endTime);
		const now = Date.now();

		// Check if expedition is complete
		if (now >= expedition.endTime) {
			// Send resolve request
			PacketUtils.sendPacketToBackend(context, makePacket(CommandPetExpeditionResolvePacketReq, {}));
			return;
		}

		// Show expedition in progress with recall option
		const locationEmoji = ExpeditionConstants.getLocationEmoji(expedition.locationType as ExpeditionLocationType);
		const locationName = i18n.t(`commands:petExpedition.locations.${expedition.locationType}`, { lng });
		const petDisplay = `${DisplayUtils.getPetIcon(expedition.petId, expedition.petSex as SexTypeShort)} **${DisplayUtils.getPetNicknameOrTypeName(expedition.petNickname ?? null, expedition.petId, expedition.petSex as SexTypeShort, lng)}**`;
		const sexContext = getSexContext(expedition.petSex as SexTypeShort);

		// Build food info string if food was consumed
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
					returnTime: finishInTimeDisplay(endTime),
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

		const reply = await interaction.followUp({
			embeds: [embed],
			components: [row]
		});

		if (!reply) {
			return;
		}

		const collector = reply.createMessageComponentCollector({
			time: Constants.MESSAGES.COLLECTOR_TIME
		});

		collector.on("collect", async (buttonInteraction: ButtonInteraction) => {
			if (buttonInteraction.user.id !== interaction.user.id) {
				await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
				return;
			}

			if (buttonInteraction.customId === "expedition_recall") {
				PacketUtils.sendPacketToBackend(context, makePacket(CommandPetExpeditionRecallPacketReq, {}));
				await buttonInteraction.deferUpdate();
				collector.stop();
			}
			else if (buttonInteraction.customId === "expedition_cancel_view") {
				await buttonInteraction.update({ components: [] });
				collector.stop();
			}
		});

		collector.on("end", async () => {
			recallButton.setDisabled(true);
			cancelButton.setDisabled(true);
			await reply.edit({ components: [row] }).catch(() => null);
		});

		return;
	}

	// Check if player can start an expedition
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
		return;
	}

	// Request expedition options
	PacketUtils.sendPacketToBackend(context, makePacket(CommandPetExpeditionGeneratePacketReq, {}));
}

/**
 * Handle the expedition generation response - show 3 options to choose from
 */
export async function handleExpeditionGenerateRes(
	context: PacketContext,
	packet: CommandPetExpeditionGeneratePacketRes
): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}

	const lng = interaction.userLanguage;
	const petDisplay = packet.petId && packet.petSex
		? `${DisplayUtils.getPetIcon(packet.petId, packet.petSex as SexTypeShort)} **${DisplayUtils.getPetNicknameOrTypeName(packet.petNickname ?? null, packet.petId, packet.petSex as SexTypeShort, lng)}**`
		: i18n.t("commands:pet.defaultPetName", { lng });

	// Build the embed with expedition options
	let description = i18n.t("commands:petExpedition.chooseExpedition", {
		lng,
		petDisplay
	});

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("expedition_choice")
		.setPlaceholder(i18n.t("commands:petExpedition.selectPlaceholder", { lng }));

	for (let i = 0; i < packet.expeditions.length; i++) {
		const exp = packet.expeditions[i];
		const locationEmoji = ExpeditionConstants.getLocationEmoji(exp.locationType as ExpeditionLocationType);
		const locationName = i18n.t(`commands:petExpedition.locations.${exp.locationType}`, { lng });

		description += `\n\n${i18n.t("commands:petExpedition.expeditionOption", {
			lng,
			number: i + 1,
			location: `${locationEmoji} ${locationName}`,
			duration: formatDuration(exp.durationMinutes, lng),
			risk: getTranslatedRiskCategoryName(exp.riskRate, lng),
			wealth: getTranslatedWealthCategoryName(exp.wealthRate, lng),
			difficulty: getTranslatedDifficultyCategoryName(exp.difficulty, lng),
			foodCost: exp.foodCost ?? 1
		})}`;

		selectMenu.addOptions({
			label: `${locationEmoji} ${locationName}`,
			description: `${formatDuration(exp.durationMinutes, lng)} - ${getTranslatedRiskCategoryName(exp.riskRate, lng)}`,
			value: exp.id
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
		.setStyle(ButtonStyle.Danger);
	buttonRow.addComponents(cancelButton);

	const reply = await interaction.followUp({
		embeds: [embed],
		components: [selectRow, buttonRow]
	});

	if (!reply) {
		return;
	}

	const collector = reply.createMessageComponentCollector({
		time: Constants.MESSAGES.COLLECTOR_TIME
	});

	const userInteractedReason = "userInteracted";

	collector.on("collect", async componentInteraction => {
		if (componentInteraction.user.id !== interaction.user.id) {
			await sendInteractionNotForYou(componentInteraction.user, componentInteraction, lng);
			return;
		}

		if (componentInteraction.isStringSelectMenu()) {
			const menuInteraction = componentInteraction as StringSelectMenuInteraction;
			const chosenId = menuInteraction.values[0];

			// Send the choice to backend
			PacketUtils.sendPacketToBackend(
				context,
				makePacket(CommandPetExpeditionChoicePacketReq, { expeditionId: chosenId })
			);

			await menuInteraction.deferUpdate();
			collector.stop(userInteractedReason);
		}
		else if (componentInteraction.isButton()) {
			const buttonInteraction = componentInteraction as ButtonInteraction;
			if (buttonInteraction.customId === "expedition_cancel") {
				PacketUtils.sendPacketToBackend(context, makePacket(CommandPetExpeditionCancelPacketReq, {}));
				await buttonInteraction.deferUpdate();
				collector.stop(userInteractedReason);
			}
		}
	});

	collector.on("end", async (_, reason) => {
		selectMenu.setDisabled(true);
		cancelButton.setDisabled(true);
		await reply.edit({ components: [selectRow, buttonRow] }).catch(() => null);

		// If the collector timed out (user didn't interact), treat it as a cancel
		if (reason !== userInteractedReason) {
			PacketUtils.sendPacketToBackend(context, makePacket(CommandPetExpeditionCancelPacketReq, {}));
		}
	});
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
		await interaction.followUp({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t(`commands:petExpedition.errors.${packet.failureReason}`, { lng })
				)
			],
			ephemeral: true
		});
		return;
	}

	const expedition = packet.expedition!;
	const locationEmoji = ExpeditionConstants.getLocationEmoji(expedition.locationType as ExpeditionLocationType);
	const locationName = i18n.t(`commands:petExpedition.locations.${expedition.locationType}`, { lng });
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
		description += `\n${i18n.t("commands:petExpedition.foodConsumed", {
			lng,
			amount: packet.foodConsumed
		})}`;
	}

	if (packet.insufficientFood) {
		// Choose the right message depending on the cause (no guild / guild with no food). Default to a friendly no-guild message if not provided.
		const cause = (packet as unknown as { insufficientFoodCause?: "noGuild" | "guildNoFood" }).insufficientFoodCause;
		if (cause === "guildNoFood") {
			description += `\n${i18n.t("commands:petExpedition.insufficientFoodWarning.guildNoFood", { lng })}`;
		}
		else {
			description += `\n${i18n.t("commands:petExpedition.insufficientFoodWarning.noGuild", { lng })}`;
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

	await interaction.followUp({ embeds: [embed] });
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

	await interaction.followUp({ embeds: [embed] });
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

	await interaction.followUp({ embeds: [embed] });
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
	const locationName = i18n.t(`commands:petExpedition.locations.${packet.expedition.locationType}`, { lng });
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
