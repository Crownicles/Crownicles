import {ICommand} from "../ICommand";
import {makePacket, PacketContext} from "../../../../Lib/src/packets/DraftBotPacket";
import {SlashCommandBuilderGenerator} from "../SlashCommandBuilderGenerator";
import {
	CommandMissionShopMoney,
	CommandMissionShopPacketReq,
	CommandMissionShopPetInformation,
	CommandMissionShopSkipMissionResult
} from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import {DiscordCache} from "../../bot/DiscordCache";
import {DraftBotEmbed} from "../../messages/DraftBotEmbed";
import i18n from "../../translations/i18n";
import {PetUtils} from "../../utils/PetUtils";
import {StringUtils} from "../../utils/StringUtils";
import {MissionUtils} from "../../utils/MissionUtils";
import {ReactionCollectorSkipMissionShopItemReaction} from "../../../../Lib/src/packets/interaction/ReactionCollectorSkipMissionShopItem";
import {DiscordCollectorUtils} from "../../utils/DiscordCollectorUtils";
import {ReactionCollectorCreationPacket} from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {Constants} from "../../../../Lib/src/constants/Constants";

/**
 * Get the packet to send to the server
 */
function getPacket(): CommandMissionShopPacketReq {
	return makePacket(CommandMissionShopPacketReq, {});
}

async function handleBasicMissionShopItem(context: PacketContext, descriptionString: string, descriptionFormat: {
	[keys: string]: string | number
}): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	await interaction?.followUp({
		embeds: [
			new DraftBotEmbed()
				.formatAuthor(i18n.t("commands:shop.shopItems.basicMission.giveTitle", {
					lng: interaction.userLanguage,
					pseudo: interaction.user.username
				}), interaction.user)
				.setDescription(i18n.t(descriptionString, {
					lng: interaction.userLanguage,
					...descriptionFormat
				}))
		]
	});
}

export async function handleMissionShopBadge(context: PacketContext): Promise<void> {
	await handleBasicMissionShopItem(context, "commands:shop.badgeBought", {badgeName: "questMasterBadge"});
}

export async function handleMissionShopMoney(packet: CommandMissionShopMoney, context: PacketContext): Promise<void> {
	await handleBasicMissionShopItem(context, "commands:shop.shopItems.money.giveDescription", {amount: packet.amount});
}

export async function handleMissionShopKingsFavor(context: PacketContext): Promise<void> {
	await handleBasicMissionShopItem(context, "commands:shop.shopItems.kingsFavor.giveDescription", {thousand_points: Constants.MISSION_SHOP.THOUSAND_POINTS});
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
					pseudo: interaction.user.username
				}), interaction.user)
				.setDescription(i18n.t("commands:shop.shopItems.lovePointsValue.giveDesc", {
					lng,
					petName: PetUtils.petToShortString(lng, packet.nickname, packet.typeId, packet.sex),
					actualLP: packet.lovePoints,
					diet: PetUtils.getDietDisplay(packet.diet, lng),
					nextFeed: PetUtils.getFeedCooldownDisplay(packet.nextFeed, lng),
					commentOnResult: StringUtils.getRandomTranslation(`commands:shop.shopItems.lovePointsValue.advice.${packet.loveLevel}`, lng),
					interpolation: {escapeValue: false}
				}))
		]
	});
}

export async function skipMissionShopItemCollector(packet: ReactionCollectorCreationPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!interaction) {
		return;
	}
	const embed = new DraftBotEmbed()
		.formatAuthor(i18n.t("commands:shop.shopItems.skipMission.giveTitle", {
			lng: interaction.userLanguage,
			pseudo: interaction.user.username
		}), interaction.user)
		.setDescription(`${i18n.t("commands:shop.shopItems.skipMission.giveDesc", {
			lng: interaction.userLanguage
		})}\n\n`);
	const reactions: ReactionCollectorSkipMissionShopItemReaction[] = packet.reactions
		.map(reaction => reaction.data as ReactionCollectorSkipMissionShopItemReaction)
		.filter(reaction => reaction.mission);
	await DiscordCollectorUtils.createChoiceListCollector(
		interaction,
		embed,
		packet,
		context,
		reactions.map(reaction => MissionUtils.formatBaseMission(reaction.mission, interaction.userLanguage)),
		true
	);
}

export async function skipMissionShopResult(packet: CommandMissionShopSkipMissionResult, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction!);
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (!interaction) {
		return;
	}
	await buttonInteraction?.editReply({
		embeds: [
			new DraftBotEmbed()
				.formatAuthor(i18n.t("commands:shop.shopItems.skipMission.successTitle", {
					lng: interaction.userLanguage,
					pseudo: interaction.user.username
				}), interaction.user)
				.setDescription(`${i18n.t("commands:shop.shopItems.skipMission.successDescription", {
					lng: interaction.userLanguage,
					mission: MissionUtils.formatBaseMission(packet.oldMission, interaction.userLanguage)
				})}\n${i18n.t("commands:shop.shopItems.skipMission.getNewMission", {
					lng: interaction.userLanguage,
					mission: MissionUtils.formatBaseMission(packet.newMission, interaction.userLanguage)
				})}`)
		]
	});
}


export const commandInfo: ICommand = {
	slashCommandBuilder: SlashCommandBuilderGenerator.generateBaseCommand("missionsshop"),
	getPacket,
	mainGuildCommand: false
};