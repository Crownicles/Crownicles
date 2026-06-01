import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import i18n from "../../../translations/i18n";
import { SmallEventBonusGuildPVEIslandPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventBonusGuildPVEIslandPacket";

export default class BonusGuildPVEIslandSmallEventHandler {
	@packetHandler(SmallEventBonusGuildPVEIslandPacket)
	async smallEventBonusGuildPVEIsland(context: PacketContext, packet: SmallEventBonusGuildPVEIslandPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"bonusGuildPVEIsland",
					`${i18n.t(`smallEvents:bonusGuildPVEIsland.events.${packet.event}.intro`, { lng })}\n\n${
						i18n.t(`smallEvents:bonusGuildPVEIsland.events.${packet.event}.${packet.result}.${packet.surrounding}`, {
							lng,
							amount: packet.amount,
							emoteKey: packet.isExperienceGain ? "xp" : "guildPoint"
						})}`,
					interaction.user,
					lng
				)
			]
		});
	}
}
