import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandMissionShopMoney,
	CommandMissionShopPacketReq,
	CommandMissionShopPetInformation,
	CommandMissionShopSkipMissionResult
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

export async function handleLovePointsValueShopItem(packet: CommandMissionShopPetInformation, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;

	// Build expedition section
	let expeditionSection = "";
	const hasLiked = packet.likedExpeditionTypes && packet.likedExpeditionTypes.length > 0;
	const hasDisliked = packet.dislikedExpeditionTypes && packet.dislikedExpeditionTypes.length > 0;

	if (hasLiked || hasDisliked) {
		const likedLocations = hasLiked
			? i18n.t("commands:shop.shopItems.lovePointsValue.likedLocations", {
				lng,
				locations: packet.likedExpeditionTypes!.map(type => i18n.t(`models:mapTypes.${type}.name`, { lng })).join(", ")
			})
			: "";
		const dislikedLocations = hasDisliked
			? i18n.t("commands:shop.shopItems.lovePointsValue.dislikedLocations", {
				lng,
				locations: packet.dislikedExpeditionTypes!.map(type => i18n.t(`models:mapTypes.${type}.name`, { lng })).join(", ")
			})
			: "";
		expeditionSection = i18n.t("commands:shop.shopItems.lovePointsValue.expeditionPreferences", {
			lng,
			likedLocations,
			dislikedLocations
		});
	}
	else {
		expeditionSection = i18n.t("commands:shop.shopItems.lovePointsValue.noPreferences", { lng });
	}

	// Add fatigue reset message if applicable
	if (packet.fatigueReset) {
		expeditionSection += i18n.t("commands:shop.shopItems.lovePointsValue.fatigueReset", { lng });
	}

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


export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("missionsshop"),
	getPacket,
	mainGuildCommand: false
};
