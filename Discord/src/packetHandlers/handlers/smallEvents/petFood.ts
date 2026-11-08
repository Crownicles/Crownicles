import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { MessagesUtils } from "../../../utils/MessagesUtils";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { getPetFoodDescription } from "../../../smallEvents/petFood";
import { SmallEventPetFoodPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventPetFoodPacket";

export default class PetFoodSmallEventHandler {
	@packetHandler(SmallEventPetFoodPacket)
	async smallEventPetFood(context: PacketContext, packet: SmallEventPetFoodPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = context.discord!.language;

		const description = getPetFoodDescription(packet, lng);

		const embed = new CrowniclesSmallEventEmbed(
			"petFood",
			description,
			MessagesUtils.getClickUser(context) ?? interaction.user,
			lng
		);

		await MessagesUtils.editClickReply(context, {
			embeds: [embed], components: []
		});
	}
}
