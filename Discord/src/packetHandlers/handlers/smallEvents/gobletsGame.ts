import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { escapeUsername } from "../../../utils/StringUtils";
import i18n from "../../../translations/i18n";
import { CrowniclesIcons } from "../../../../../Lib/src/CrowniclesIcons";
import {
	SmallEventGobletsGameMalus, SmallEventGobletsGamePacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventGobletsGamePacket";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";
import { CrowniclesEmbed } from "../../../messages/CrowniclesEmbed";

export default class GobletsGameSmallEventHandler {
	@packetHandler(SmallEventGobletsGamePacket)
	async smallEventGobletsGame(context: PacketContext, packet: SmallEventGobletsGamePacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;

		/*
		 * For ITEM result, the item display is handled by the ItemFound system
		 * We just need to display a different message
		 */
		const resultKey = packet.malus === SmallEventGobletsGameMalus.ITEM
			? "smallEvents:gobletsGame.results.item"
			: `smallEvents:gobletsGame.results.${packet.malus}`;

		const goblet = packet.goblet ?? RandomUtils.crowniclesRandom.pick(Object.keys(CrowniclesIcons.goblets));
		const gobletEmote = CrowniclesIcons.goblets[goblet] ?? "";

		await interaction.followUp({
			embeds: [
				new CrowniclesEmbed()
					.formatAuthor(
						i18n.t("commands:report.journal", {
							lng,
							pseudo: escapeUsername(interaction.user.displayName)
						}),
						interaction.user
					)
					.setDescription(
						`${gobletEmote} ${i18n.t(resultKey, {
							lng,
							quantity: packet.malus === SmallEventGobletsGameMalus.TIME ? i18n.formatDuration(packet.value, lng) : packet.value,
							goblet
						})}`
					)
			]
		});
	}
}
