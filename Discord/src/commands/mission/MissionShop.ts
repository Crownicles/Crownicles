import { ICommand } from "../ICommand";
import {
	makePacket, PacketContext
} from "../../../../Lib/src/packets/DraftBotPacket";
import { SlashCommandBuilderGenerator } from "../SlashCommandBuilderGenerator";
import {
	CommandMissionShopMoney,
	CommandMissionShopPacketReq,
	CommandMissionShopPetInformation,
	CommandMissionShopSkipMissionResult
} from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { DraftBotEmbed } from "../../messages/DraftBotEmbed";
import i18n from "../../translations/i18n";
import { PetUtils } from "../../utils/PetUtils";
import {
	escapeUsername, StringUtils
} from "../../utils/StringUtils";
import { MissionUtils } from "../../utils/MissionUtils";
import {
	ReactionCollectorSkipMissionShopItemCloseReaction,
	ReactionCollectorSkipMissionShopItemReaction
} from "../../../../Lib/src/packets/interaction/ReactionCollectorSkipMissionShopItem";
import { DiscordCollectorUtils } from "../../utils/DiscordCollectorUtils";
import { ReactionCollectorCreationPacket } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { ReactionCollectorReturnTypeOrNull } from "../../packetHandlers/handlers/ReactionCollectorHandlers";

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
			new DraftBotEmbed()
				.formatAuthor(i18n.t("commands:shop.shopItems.basicMission.giveTitle", {
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
	await handleBasicMissionShopItem(context, "commands:shop.badgeBought", { badgeName: "questMasterBadge" });
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
	await interaction.followUp({
		embeds: [
			new DraftBotEmbed()
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
					diet: PetUtils.getDietDisplay(packet.diet, lng),
					nextFeed: PetUtils.getFeedCooldownDisplay(packet.nextFeed, lng),
					commentOnFightEffect: StringUtils.getRandomTranslation(`commands:shop.shopItems.lovePointsValue.commentOnFightEffect.${packet.fightAssistId}`, lng),
					commentOnResult: StringUtils.getRandomTranslation(`commands:shop.shopItems.lovePointsValue.advice.${packet.loveLevel}`, lng)
				}))
		]
	});
}

export async function skipMissionShopItemCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;
	const embed = new DraftBotEmbed()
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
	return await DiscordCollectorUtils.createChoiceListCollector(
		interaction,
		embed,
		packet,
		context,
		reactions.map(reaction => MissionUtils.formatBaseMission(reaction.mission, lng)),
		{
			can: true,
			reactionIndex: packet.reactions.findIndex(reaction => reaction.type === ReactionCollectorSkipMissionShopItemCloseReaction.name)
		}
	);
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
			new DraftBotEmbed()
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
