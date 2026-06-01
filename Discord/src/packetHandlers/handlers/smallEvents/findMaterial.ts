import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import i18n from "../../../translations/i18n";
import { CrowniclesIcons } from "../../../../../Lib/src/CrowniclesIcons";
import { SmallEventFindMaterialPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventFindMaterialPacket";

export default class FindMaterialSmallEventHandler {
	@packetHandler(SmallEventFindMaterialPacket)
	async smallEventFindMaterial(context: PacketContext, packet: SmallEventFindMaterialPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;

		const typeStory = i18n.t(`smallEvents:findMaterial.typesStories.${packet.materialType}`, { lng });
		const foundStory = i18n.t(`smallEvents:findMaterial.foundStories.${packet.materialRarity}`, {
			lng,
			materialId: packet.materialId,
			materialEmote: CrowniclesIcons.materials[packet.materialId],
			rarityEmote: CrowniclesIcons.rarity[packet.materialRarity - 1]
		});

		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"findMaterial",
					`${getRandomSmallEventIntro(lng)}${typeStory}\n\n${foundStory}`,
					interaction.user,
					lng
				)
			]
		});
	}
}
