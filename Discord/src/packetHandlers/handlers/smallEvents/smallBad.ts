import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import {
	SmallEventBadIssue, SmallEventSmallBadPacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventSmallBadPacket";
import i18n from "../../../translations/i18n";

export default class SmallBadSmallEventHandler {
	@packetHandler(SmallEventSmallBadPacket)
	async smallEventSmallBad(context: PacketContext, packet: SmallEventSmallBadPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		const amountDisplay = packet.issue === SmallEventBadIssue.TIME
			? i18n.formatDuration(packet.amount, lng)
			: packet.amount;

		// For TIME issue, choose translation key based on effectId
		let translationKey = `smallEvents:smallBad.${packet.issue}.stories`;
		if (packet.issue === SmallEventBadIssue.TIME && packet.effectId) {
			translationKey = `smallEvents:smallBad.${packet.issue}.${packet.effectId}.stories`;
		}

		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"smallBad",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation(translationKey, lng, { amount: amountDisplay }),
					interaction.user,
					lng
				)
			]
		});
	}
}
