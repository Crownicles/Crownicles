import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { MessagesUtils } from "../../../utils/MessagesUtils";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import i18n from "../../../translations/i18n";
import {
	SmallEventGoToPVEIslandAcceptPacket,
	SmallEventGoToPVEIslandNoAnswerPacket,
	SmallEventGoToPVEIslandNotEnoughGemsPacket,
	SmallEventGoToPVEIslandRefusePacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventGoToPVEIslandPacket";

export default class GoToPVEIslandSmallEventHandler {
	@packetHandler(SmallEventGoToPVEIslandAcceptPacket)
	async smallEventGoToPVEIslandAccept(context: PacketContext, packet: SmallEventGoToPVEIslandAcceptPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = context.discord!.language;
		await MessagesUtils.editClickReply(context, {
			embeds: [
				new CrowniclesSmallEventEmbed(
					"goToPVEIsland",
					i18n.t(`smallEvents:goToPVEIsland.endStoryAccept${packet.alone ? "" : "WithMember"}`, {
						lng,
						gainScore: packet.pointsWon > 0
							? i18n.t("smallEvents:goToPVEIsland.confirmedScore", {
								lng,
								score: packet.pointsWon
							})
							: ""
					}),
					MessagesUtils.getClickUser(context) ?? interaction.user,
					lng
				)
			]
		});
	}


	@packetHandler(SmallEventGoToPVEIslandRefusePacket)
	async smallEventGoToPVEIslandRefuse(context: PacketContext, _packet: SmallEventGoToPVEIslandRefusePacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = context.discord!.language;
		await MessagesUtils.editClickReply(context, {
			embeds: [
				new CrowniclesSmallEventEmbed(
					"goToPVEIsland",
					i18n.t("smallEvents:goToPVEIsland.endStoryRefuse", { lng }),
					MessagesUtils.getClickUser(context) ?? interaction.user,
					lng
				)
			]
		});
	}


	@packetHandler(SmallEventGoToPVEIslandNoAnswerPacket)
	async smallEventGoToPVEIslandNoAnswer(context: PacketContext, _packet: SmallEventGoToPVEIslandNoAnswerPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		await interaction.followUp({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"goToPVEIsland",
					i18n.t("smallEvents:goToPVEIsland.endStoryRefuse", { lng }),
					interaction.user,
					lng
				)
			]
		});
	}


	@packetHandler(SmallEventGoToPVEIslandNotEnoughGemsPacket)
	async smallEventGoToPVEIslandNotEnoughGems(context: PacketContext, _packet: SmallEventGoToPVEIslandNotEnoughGemsPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = context.discord!.language;
		await MessagesUtils.editClickReply(context, {
			embeds: [
				new CrowniclesSmallEventEmbed(
					"goToPVEIsland",
					i18n.t("smallEvents:goToPVEIsland.notEnoughGems", { lng }),
					MessagesUtils.getClickUser(context) ?? interaction.user,
					lng
				)
			]
		});
	}
}
