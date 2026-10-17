import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { getPetFoodDescription } from "../../../smallEvents/petFood";
import { SmallEventPetFoodPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventPetFoodPacket";

export default class PetFoodSmallEventHandler {
	@packetHandler(SmallEventPetFoodPacket)
	async smallEventPetFood(context: PacketContext, packet: SmallEventPetFoodPacket): Promise<void> {
		const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
		if (!interaction) {
			return;
		}
		const lng = context.discord!.language;

		const description = getPetFoodDescription(packet, lng);

		const embed = new CrowniclesSmallEventEmbed(
			"petFood",
			description,
			interaction.user,
			lng
		);

		await interaction.editReply({
			embeds: [embed], components: []
		});
	}
}
