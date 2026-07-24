import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { SmallEventBonusGuildPVEIslandPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventBonusGuildPVEIslandPacket";
import { buildBonusGuildPVEIslandDescription } from "../../../smallEvents/BonusGuildPVEIslandDescription";

export default class BonusGuildPVEIslandSmallEventHandler {
	@packetHandler(SmallEventBonusGuildPVEIslandPacket)
	async smallEventBonusGuildPVEIsland(context: PacketContext, packet: SmallEventBonusGuildPVEIslandPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"bonusGuildPVEIsland",
					buildBonusGuildPVEIslandDescription(packet, lng),
					interaction.user,
					lng
				)
			]
		});
	}
}
