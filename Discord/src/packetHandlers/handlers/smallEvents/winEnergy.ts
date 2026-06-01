import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import { SmallEventWinEnergyPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventWinEnergyPacket";

export default class WinEnergySmallEventHandler {
	@packetHandler(SmallEventWinEnergyPacket)
	async smallEventWinEnergy(context: PacketContext, _packet: SmallEventWinEnergyPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"winEnergy",
					getRandomSmallEventIntro(lng) + StringUtils.getRandomTranslation("smallEvents:winEnergy.stories", lng),
					interaction.user,
					lng
				)
			]
		});
	}
}
