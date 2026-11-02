import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { MessagesUtils } from "../../../utils/MessagesUtils";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import i18n from "../../../translations/i18n";
import {
	SmallEventLotteryLosePacket,
	SmallEventLotteryNoAnswerPacket,
	SmallEventLotteryPoorPacket,
	SmallEventLotteryWinPacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventLotteryPacket";

export default class LotterySmallEventHandler {
	@packetHandler(SmallEventLotteryNoAnswerPacket)
	async smallEventLotteryNoAnswer(context: PacketContext, _packet: SmallEventLotteryNoAnswerPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		await interaction.followUp({
			embeds: [new CrowniclesSmallEventEmbed("lottery", i18n.t("smallEvents:lottery.end", { lng }), interaction.user, lng)]
		});
	}


	@packetHandler(SmallEventLotteryPoorPacket)
	async smallEventLotteryPoor(context: PacketContext, _packet: SmallEventLotteryPoorPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = context.discord!.language;
		await MessagesUtils.editClickReply(context, {
			embeds: [
				new CrowniclesSmallEventEmbed(
					"lottery",
					i18n.t("smallEvents:lottery.poor", { lng }),
					MessagesUtils.getClickUser(context) ?? interaction.user,
					lng
				)
			]
		});
	}


	@packetHandler(SmallEventLotteryLosePacket)
	async smallEventLotteryLose(context: PacketContext, packet: SmallEventLotteryLosePacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = context.discord!.language;
		const lostTimeDisplay = i18n.formatDuration(packet.lostTime, lng);
		await MessagesUtils.editClickReply(context, {
			embeds: [
				new CrowniclesSmallEventEmbed(
					"lottery",
					i18n.t(`smallEvents:lottery.${packet.level}.${packet.moneyLost > 0 ? "failWithMalus" : "fail"}`, {
						lng,
						lostTime: packet.lostTime,
						lostTimeDisplay,
						money: packet.moneyLost
					}),
					MessagesUtils.getClickUser(context) ?? interaction.user,
					lng
				)
			]
		});
	}


	@packetHandler(SmallEventLotteryWinPacket)
	async smallEventLotteryWin(context: PacketContext, packet: SmallEventLotteryWinPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = context.discord!.language;
		const lostTimeDisplay = i18n.formatDuration(packet.lostTime, lng);
		await MessagesUtils.editClickReply(context, {
			embeds: [
				new CrowniclesSmallEventEmbed(
					"lottery",
					i18n.t(`smallEvents:lottery.${packet.level}.success`, {
						lng,
						lostTime: packet.lostTime,
						lostTimeDisplay
					}) + i18n.t(`smallEvents:lottery.rewardTypeText.${packet.winReward}`, {
						lng,
						reward: packet.winAmount
					}),
					MessagesUtils.getClickUser(context) ?? interaction.user,
					lng
				)
			]
		});
	}
}
