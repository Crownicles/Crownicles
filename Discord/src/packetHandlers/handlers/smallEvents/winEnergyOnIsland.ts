import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import { SmallEventWinEnergyOnIslandPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventWinEnergyOnIslandPacket";

export default class WinEnergyOnIslandSmallEventHandler {
	@packetHandler(SmallEventWinEnergyOnIslandPacket)
	async smallEventWinFightPoints(context: PacketContext, packet: SmallEventWinEnergyOnIslandPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"winEnergyOnIsland",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation(
						"smallEvents:winEnergyOnIsland.stories",
						lng,
						{ energy: packet.amount }
					),
					interaction.user,
					lng
				)
			]
		});
	}
}
