import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import { PetUtils } from "../../../utils/PetUtils";
import { SmallEventPetDropTokenPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventPetDropTokenPacket";
import { resolveKeycloakPlayerName } from "../../../utils/KeycloakPlayerUtils";

export default class PetDropTokenSmallEventHandler {
	@packetHandler(SmallEventPetDropTokenPacket)
	async smallEventPetDropToken(context: PacketContext, packet: SmallEventPetDropTokenPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const petDisplay = PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex);
		const ownerName = await resolveKeycloakPlayerName(packet.ownerKeycloakId, lng);
		await interaction.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"petDropToken",
					getRandomSmallEventIntro(lng)
					+ StringUtils.getRandomTranslation("smallEvents:petDropToken.stories", lng, {
						pet: petDisplay,
						owner: ownerName
					}),
					interaction.user,
					lng
				)
			]
		});
	}
}
