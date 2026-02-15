import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandMissionShopMarketAnalysis,
	CommandMissionShopMoney,
	CommandMissionShopPacketReq,
	CommandMissionShopPetInformation,
	CommandMissionShopSkipMissionResult,
	MarketTrend
} from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { PetUtils } from "../../utils/PetUtils";
import {
	escapeUsername, StringUtils
} from "../../utils/StringUtils";
import { MissionUtils } from "../../utils/MissionUtils";
import {
	ReactionCollectorSkipMissionShopItemCloseReaction,
	ReactionCollectorSkipMissionShopItemPacket,
	ReactionCollectorSkipMissionShopItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorSkipMissionShopItem";
import {
	DiscordCollectorUtils, SEND_POLITICS
} from "../../utils/DiscordCollectorUtils";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";
import { Badge } from "../../../../Lib/src/types/Badge";
import { millisecondsToMinutes } from "../../../../Lib/src/utils/TimeUtils";
import { PetConstants } from "../../../../Lib/src/constants/PetConstants";
import { Language } from "../../../../Lib/src/Language";
import { CrowniclesIcons } from "../../../../Lib/src/CrowniclesIcons";
import { ExpeditionLocationType } from "../../../../Lib/src/constants/ExpeditionConstants";
import { PlantConstants } from "../../../../Lib/src/constants/PlantConstants";

/**
 * Get the packet to send to the server
 */
function getPacket(): CommandMissionShopPacketReq {
	return makePacket(CommandMissionShopPacketReq, {});
}

async function handleBasicMissionShopItem(context: PacketContext, descriptionString: string, descriptionFormat: {
	[keys: string]: string | number;
}): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	await interaction.followUp({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:missionsshop.success", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(i18n.t(descriptionString, {
					lng,
					...descriptionFormat
				}))
		]
	});
}

export async function handleMissionShopBadge(context: PacketContext): Promise<void> {
	await handleBasicMissionShopItem(context, "commands:shop.badgeBought", { badgeName: Badge.MISSION_COMPLETER });
}

export async function handleMissionShopMoney(packet: CommandMissionShopMoney, context: PacketContext): Promise<void> {
	await handleBasicMissionShopItem(context, "commands:shop.shopItems.money.giveDescription", { amount: packet.amount });
}

export async function handleMissionShopKingsFavor(context: PacketContext): Promise<void> {
	await handleBasicMissionShopItem(context, "commands:shop.shopItems.kingsFavor.giveDescription", { thousandPoints: Constants.MISSION_SHOP.THOUSAND_POINTS });
}

/**
 * Format an expedition location type with its emoji and name
 */
function formatLocationType(type: string, lng: Language): string {
	const emoji = CrowniclesIcons.expedition.locations[type as ExpeditionLocationType] ?? "";
	const name = i18n.t(`models:map_types.${type}.name`, { lng });
	return `${emoji} ${name}`;
}

/**
 * Build the expedition preferences section for the pet information embed
 */
function buildExpeditionSection(packet: CommandMissionShopPetInformation, lng: Language): string {
	const hasLiked = packet.likedExpeditionTypes && packet.likedExpeditionTypes.length > 0;
	const hasDisliked = packet.dislikedExpeditionTypes && packet.dislikedExpeditionTypes.length > 0;

	if (!hasLiked && !hasDisliked) {
		return i18n.t("commands:shop.shopItems.lovePointsValue.noPreferences", { lng });
	}

	const likedLocations = hasLiked
		? i18n.t("commands:shop.shopItems.lovePointsValue.likedLocations", {
			lng,
			locations: packet.likedExpeditionTypes!.map(type => formatLocationType(type, lng)).join(", ")
		})
		: "";
	const dislikedLocations = hasDisliked
		? i18n.t("commands:shop.shopItems.lovePointsValue.dislikedLocations", {
			lng,
			locations: packet.dislikedExpeditionTypes!.map(type => formatLocationType(type, lng)).join(", ")
		})
		: "";

	return i18n.t("commands:shop.shopItems.lovePointsValue.expeditionPreferences", {
		lng,
		likedLocations,
		dislikedLocations
	});
}

export async function handleLovePointsValueShopItem(packet: CommandMissionShopPetInformation, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;

	const expeditionSection = buildExpeditionSection(packet, lng);

	await interaction.followUp({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:shop.shopItems.lovePointsValue.giveTitle", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(i18n.t("commands:shop.shopItems.lovePointsValue.giveDesc", {
					lng,
					petName: PetUtils.petToShortString(lng, packet.nickname, packet.typeId, packet.sex),
					commentOnPetAge: i18n.t("commands:shop.shopItems.lovePointsValue.ageComment", {
						lng,
						context: packet.ageCategory,
						age: packet.petId - 1
					}),
					actualLP: packet.lovePoints,
					maxLovePoints: PetConstants.MAX_LOVE_POINTS,
					diet: PetUtils.getDietDisplay(packet.diet, lng),
					force: packet.force,
					speed: packet.speed,
					feedDelay: i18n.formatDuration(millisecondsToMinutes(packet.feedDelay), lng),
					nextFeed: PetUtils.getFeedCooldownDisplay(packet.nextFeed, lng),
					commentOnFightEffect: StringUtils.getRandomTranslation(`commands:shop.shopItems.lovePointsValue.commentOnFightEffect.${packet.fightAssistId}`, lng),
					commentOnResult: StringUtils.getRandomTranslation(`commands:shop.shopItems.lovePointsValue.advice.${packet.loveLevel}`, lng),
					expeditionSection,
					dwarfPet: packet.randomPetDwarf
						? StringUtils.getRandomTranslation("commands:shop.shopItems.lovePointsValue.dwarf", lng, {
							pet: PetUtils.petToShortString(lng, undefined, packet.randomPetDwarf.typeId, packet.randomPetDwarf.sex),
							numberOfPetsNotSeen: packet.randomPetDwarf.numberOfPetsNotSeen
						})
						: ""
				}))
		]
	});
}

export async function skipMissionShopItemCollector(context: PacketContext, packet: ReactionCollectorSkipMissionShopItemPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;
	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:shop.shopItems.skipMission.giveTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(`${i18n.t("commands:shop.shopItems.skipMission.giveDesc", {
			lng
		})}\n\n`);
	const reactions: ReactionCollectorSkipMissionShopItemReaction[] = packet.reactions
		.map(reaction => reaction.data as ReactionCollectorSkipMissionShopItemReaction)
		.filter(reaction => reaction.mission);
	return await DiscordCollectorUtils.createChoiceListCollector(interaction, {
		packet,
		context
	}, {
		embed,
		items: reactions.map(reaction => MissionUtils.formatBaseMission(reaction.mission, lng))
	}, {
		refuse: {
			can: true,
			reactionIndex: packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorSkipMissionShopItemCloseReaction.name)
		},
		sendManners: SEND_POLITICS.ALWAYS_FOLLOWUP
	});
}

export async function skipMissionShopResult(packet: CommandMissionShopSkipMissionResult, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	await buttonInteraction?.editReply({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:shop.shopItems.skipMission.successTitle", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(`${i18n.t("commands:shop.shopItems.skipMission.successDescription", {
					lng,
					mission: MissionUtils.formatBaseMission(packet.oldMission, lng)
				})}\n${i18n.t("commands:shop.shopItems.skipMission.getNewMission", {
					lng,
					mission: MissionUtils.formatBaseMission(packet.newMission, lng)
				})}`)
		]
	});
}


/**
 * Get the translation key suffix for a given market trend
 */
function getTrendKey(trend: MarketTrend): string {
	switch (trend) {
		case MarketTrend.BIG_DROP:
			return "bigDrop";
		case MarketTrend.DROP:
			return "drop";
		case MarketTrend.STABLE:
			return "stable";
		case MarketTrend.RISE:
			return "rise";
		case MarketTrend.BIG_RISE:
			return "bigRise";
		default:
			return "stable";
	}
}

/**
 * Get the horizon label translation key
 */
function getHorizonLabel(horizonIndex: number): string {
	return [
		"tomorrow",
		"threeDays",
		"oneWeek"
	][horizonIndex];
}

/**
 * Build the plant rotation notice and new plant forecasts
 */
function buildRotationSection(packet: CommandMissionShopMarketAnalysis, lng: Language): string {
	if (!packet.plantRotation) {
		return "";
	}

	const timeHorizons = [
		"tomorrow",
		"threeDays",
		"oneWeek"
	] as const;

	const horizonLabel = i18n.t(`commands:shop.shopItems.marketAnalysis.horizonLabels.${getHorizonLabel(packet.plantRotation.horizonIndex)}`, { lng });
	const newPlantsList = packet.plantRotation.newPlantIds.map(plantId => {
		const plantEmoji = CrowniclesIcons.plants[plantId] ?? "🌱";
		const plantName = i18n.t(`commands:home.manage.garden.plants.${plantId}`, { lng });
		return `${plantEmoji} ${plantName}`;
	}).join(", ");

	let text = `\n\n${i18n.t("commands:shop.shopItems.marketAnalysis.rotation", {
		lng,
		horizon: horizonLabel,
		newPlants: newPlantsList
	})}`;

	// Show forecasts for each new plant at post-rotation horizons
	for (const forecast of packet.plantRotation.newPlantForecasts) {
		const plantName = i18n.t(`commands:home.manage.garden.plants.${forecast.plantId}`, { lng });
		const plantEmoji = CrowniclesIcons.plants[forecast.plantId] ?? "🌱";
		text += `\n\n${plantEmoji} **${plantName}** :`;
		for (let i = 0; i < timeHorizons.length; i++) {
			if (forecast.trends[i] === null) {
				continue; // Plant not available at this horizon
			}
			const horizon = timeHorizons[i];
			const trendKey = getTrendKey(forecast.trends[i]!);
			text += `\n${i18n.t(`commands:shop.shopItems.marketAnalysis.newPlants.${horizon}.${trendKey}`, {
				lng,
				plantName,
				plantEmoji
			})}`;
		}
	}

	return text;
}

/**
 * Build the market analysis text from the packet data
 */
function buildMarketAnalysisText(packet: CommandMissionShopMarketAnalysis, lng: Language): string {
	const timeHorizons = [
		"tomorrow",
		"threeDays",
		"oneWeek"
	] as const;

	// Intro
	let text = i18n.t("commands:shop.shopItems.marketAnalysis.intro", { lng });

	// King's money section
	text += `\n\n${i18n.t("commands:shop.shopItems.marketAnalysis.kingsMoneyTitle", { lng })}`;
	for (let i = 0; i < timeHorizons.length; i++) {
		const horizon = timeHorizons[i];
		const trendKey = getTrendKey(packet.kingsMoneyTrends[i]);
		text += `\n${i18n.t(`commands:shop.shopItems.marketAnalysis.kingsMoney.${horizon}.${trendKey}`, { lng })}`;
	}

	// Plants section
	text += `\n\n${i18n.t("commands:shop.shopItems.marketAnalysis.plantsTitle", { lng })}`;
	for (const plantTrend of packet.plantTrends) {
		const plant = PlantConstants.getPlantById(plantTrend.plantId);
		if (!plant) {
			continue;
		}
		const plantName = i18n.t(`commands:home.manage.garden.plants.${plantTrend.plantId}`, { lng });
		const plantEmoji = CrowniclesIcons.plants[plantTrend.plantId] ?? "🌱";
		text += `\n\n${plantEmoji} **${plantName}** :`;

		// Only show trends for horizons where the plant is still available
		for (let i = 0; i < timeHorizons.length; i++) {
			if (plantTrend.trends[i] === null) {
				break; // Rotation happened, no more trend data for this plant
			}
			const horizon = timeHorizons[i];
			const trendKey = getTrendKey(plantTrend.trends[i]!);
			text += `\n${i18n.t(`commands:shop.shopItems.marketAnalysis.plants.${horizon}.${trendKey}`, {
				lng,
				plantName,
				plantEmoji
			})}`;
		}
	}

	// Rotation notice and new plant forecasts if applicable
	text += buildRotationSection(packet, lng);

	// Outro
	text += `\n\n${i18n.t("commands:shop.shopItems.marketAnalysis.outro", { lng })}`;

	return text;
}

export async function handleMarketAnalysis(packet: CommandMissionShopMarketAnalysis, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	await interaction.followUp({
		embeds: [
			new CrowniclesEmbed()
				.formatAuthor(i18n.t("commands:shop.shopItems.marketAnalysis.giveTitle", {
					lng,
					pseudo: escapeUsername(interaction.user.displayName)
				}), interaction.user)
				.setDescription(buildMarketAnalysisText(packet, lng))
		]
	});
}


export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("missionsshop"),
	getPacket,
	mainGuildCommand: false
};
