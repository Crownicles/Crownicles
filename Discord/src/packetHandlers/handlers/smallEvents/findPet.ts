import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import { SmallEventFindPetPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventFindPetPacket";
import { PetUtils } from "../../../utils/PetUtils";

export default class FindPetSmallEventHandler {
	@packetHandler(SmallEventFindPetPacket)
	async smallEventFindPet(context: PacketContext, packet: SmallEventFindPetPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const translationKey = packet.isPetReceived
			? packet.petIsReceivedByGuild
				? "givePetGuild"
				: "givePetPlayer"
			: packet.isPetFood
				? "food"
				: "noFood";
		await interaction.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"findPet",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation(
						`smallEvents:findPet.${translationKey}`,
						lng,
						{
							context: packet.petSex,
							pet: PetUtils.petToShortString(lng, undefined, packet.petTypeID, packet.petSex)
						}
					),
					interaction.user,
					lng
				)
			]
		});
	}
}
