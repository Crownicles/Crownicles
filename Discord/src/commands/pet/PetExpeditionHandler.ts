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
import { escapeUsername } from "../../utils/StringUtils";
import { finishInTimeDisplay } from "../../../../Lib/src/utils/TimeUtils";
import { ExpeditionConstants } from "../../../../Lib/src/constants/ExpeditionConstants";
import { Language } from "../../../../Lib/src/Language";
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
 * Get the emoji for a location type
 */
function getLocationEmoji(locationType: string): string {
	const emojiMap: Record<string, string> = {
		[ExpeditionConstants.LOCATION_TYPES.FOREST]: "🌲",
		[ExpeditionConstants.LOCATION_TYPES.MOUNTAIN]: "⛰️",
		[ExpeditionConstants.LOCATION_TYPES.DESERT]: "🏜️",
		[ExpeditionConstants.LOCATION_TYPES.SWAMP]: "🌿",
		[ExpeditionConstants.LOCATION_TYPES.RUINS]: "🏛️",
		[ExpeditionConstants.LOCATION_TYPES.CAVE]: "🕳️",
		[ExpeditionConstants.LOCATION_TYPES.PLAINS]: "🌾",
		[ExpeditionConstants.LOCATION_TYPES.COAST]: "🏖️"
	};
	return emojiMap[locationType] || "🗺️";
}

/**
 * Get the risk category name for display
 */
function getRiskCategoryName(riskRate: number, lng: Language): string {
	if (riskRate <= 15) {
		return i18n.t("commands:petExpedition.riskCategories.veryLow", { lng });
	}
	if (riskRate <= 30) {
		return i18n.t("commands:petExpedition.riskCategories.low", { lng });
	}
	if (riskRate <= 50) {
		return i18n.t("commands:petExpedition.riskCategories.medium", { lng });
	}
	if (riskRate <= 70) {
		return i18n.t("commands:petExpedition.riskCategories.high", { lng });
	}
	return i18n.t("commands:petExpedition.riskCategories.veryHigh", { lng });
}

/**
 * Get the wealth category name for display
 */
function getWealthCategoryName(wealthRate: number, lng: Language): string {
	if (wealthRate <= 0.5) {
		return i18n.t("commands:petExpedition.wealthCategories.poor", { lng });
	}
	if (wealthRate <= 1.0) {
		return i18n.t("commands:petExpedition.wealthCategories.modest", { lng });
	}
	if (wealthRate <= 1.5) {
		return i18n.t("commands:petExpedition.wealthCategories.rich", { lng });
	}
	return i18n.t("commands:petExpedition.wealthCategories.legendary", { lng });
}

/**
 * Format duration for display
 */
function formatDuration(minutes: number, lng: Language): string {
	if (minutes < 60) {
		return i18n.t("commands:petExpedition.duration.minutes", {
			lng,
			count: minutes
		});
	}
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
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

	// Check if player has talisman
	if (!packet.hasTalisman) {
		await interaction.followUp({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t("commands:petExpedition.noTalisman", { lng })
				)
			],
			ephemeral: true
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
		const locationEmoji = getLocationEmoji(expedition.locationType);
		const locationName = i18n.t(`commands:petExpedition.locations.${expedition.locationType}`, { lng });

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
					petName: expedition.petNickname || i18n.t("commands:pet.defaultPetName", { lng }),
					location: `${locationEmoji} ${locationName}`,
					risk: getRiskCategoryName(expedition.riskRate, lng),
					returnTime: finishInTimeDisplay(endTime)
				})
			);

		const row = new ActionRowBuilder<ButtonBuilder>();
		const recallButton = new ButtonBuilder()
			.setCustomId("expedition_recall")
			.setLabel(i18n.t("commands:petExpedition.recallButton", { lng }))
			.setEmoji("🏠")
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
		await interaction.followUp({
			embeds: [
				new CrowniclesErrorEmbed(
					interaction.user,
					context,
					interaction,
					i18n.t(`commands:petExpedition.${packet.cannotStartReason}`, { lng })
				)
			],
			ephemeral: true
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
	const petName = packet.petNickname || i18n.t("commands:pet.defaultPetName", { lng });

	// Build the embed with expedition options
	let description = i18n.t("commands:petExpedition.chooseExpedition", {
		lng,
		petName
	}) + "\n\n";

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("expedition_choice")
		.setPlaceholder(i18n.t("commands:petExpedition.selectPlaceholder", { lng }));

	for (let i = 0; i < packet.expeditions.length; i++) {
		const exp = packet.expeditions[i];
		const locationEmoji = getLocationEmoji(exp.locationType);
		const locationName = i18n.t(`commands:petExpedition.locations.${exp.locationType}`, { lng });

		description += i18n.t("commands:petExpedition.expeditionOption", {
			lng,
			number: i + 1,
			location: `${locationEmoji} ${locationName}`,
			duration: formatDuration(exp.durationMinutes, lng),
			risk: getRiskCategoryName(exp.riskRate, lng),
			wealth: getWealthCategoryName(exp.wealthRate, lng),
			difficulty: exp.difficulty
		}) + "\n\n";

		selectMenu.addOptions({
			label: `${locationEmoji} ${locationName}`,
			description: `${formatDuration(exp.durationMinutes, lng)} - ${getRiskCategoryName(exp.riskRate, lng)}`,
			value: exp.id
		});
	}

	const embed = new CrowniclesEmbed()
		.formatAuthor(
			i18n.t("commands:petExpedition.title", {
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
		.setStyle(ButtonStyle.Secondary);
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
			collector.stop();
		}
		else if (componentInteraction.isButton()) {
			const buttonInteraction = componentInteraction as ButtonInteraction;
			if (buttonInteraction.customId === "expedition_cancel") {
				PacketUtils.sendPacketToBackend(context, makePacket(CommandPetExpeditionCancelPacketReq, {}));
				await buttonInteraction.deferUpdate();
				collector.stop();
			}
		}
	});

	collector.on("end", async () => {
		selectMenu.setDisabled(true);
		cancelButton.setDisabled(true);
		await reply.edit({ components: [selectRow, buttonRow] }).catch(() => null);
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
	const locationEmoji = getLocationEmoji(expedition.locationType);
	const locationName = i18n.t(`commands:petExpedition.locations.${expedition.locationType}`, { lng });
	const petName = expedition.petNickname || i18n.t("commands:pet.defaultPetName", { lng });

	let description = i18n.t("commands:petExpedition.expeditionStarted", {
		lng,
		petName,
		location: `${locationEmoji} ${locationName}`,
		returnTime: finishInTimeDisplay(new Date(expedition.endTime))
	});

	if (packet.foodConsumed && packet.foodConsumed > 0) {
		description += "\n" + i18n.t("commands:petExpedition.foodConsumed", {
			lng,
			amount: packet.foodConsumed
		});
	}

	if (packet.insufficientFood) {
		description += "\n" + i18n.t("commands:petExpedition.insufficientFoodWarning", { lng });
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
	const petName = packet.petNickname || i18n.t("commands:pet.defaultPetName", { lng });

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
				petName,
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
	const petName = packet.petNickname || i18n.t("commands:pet.defaultPetName", { lng });

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
				petName,
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
	const petName = packet.petNickname || i18n.t("commands:pet.defaultPetName", { lng });
	const locationEmoji = getLocationEmoji(packet.expedition.locationType);
	const locationName = i18n.t(`commands:petExpedition.locations.${packet.expedition.locationType}`, { lng });

	let description: string;
	let title: string;

	if (packet.totalFailure) {
		title = i18n.t("commands:petExpedition.failureTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		});
		description = i18n.t("commands:petExpedition.totalFailure", {
			lng,
			petName,
			location: `${locationEmoji} ${locationName}`,
			loveLost: Math.abs(packet.loveChange)
		});
	}
	else if (packet.partialSuccess) {
		title = i18n.t("commands:petExpedition.partialSuccessTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		});
		description = i18n.t("commands:petExpedition.partialSuccess", {
			lng,
			petName,
			location: `${locationEmoji} ${locationName}`
		});
		if (packet.rewards) {
			description += "\n\n" + formatRewards(packet.rewards, lng);
		}
		description += "\n" + i18n.t("commands:petExpedition.loveChange", {
			lng,
			change: packet.loveChange >= 0 ? `+${packet.loveChange}` : packet.loveChange.toString()
		});
	}
	else {
		title = i18n.t("commands:petExpedition.successTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		});
		description = i18n.t("commands:petExpedition.success", {
			lng,
			petName,
			location: `${locationEmoji} ${locationName}`
		});
		if (packet.rewards) {
			description += "\n\n" + formatRewards(packet.rewards, lng);
		}
		description += "\n" + i18n.t("commands:petExpedition.loveChange", {
			lng,
			change: `+${packet.loveChange}`
		});
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
	},
	lng: Language
): string {
	const lines: string[] = [];

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
