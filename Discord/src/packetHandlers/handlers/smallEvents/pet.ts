import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import i18n from "../../../translations/i18n";
import { CrowniclesIcons } from "../../../../../Lib/src/CrowniclesIcons";
import { DisplayUtils } from "../../../utils/DisplayUtils";
import { PetUtils } from "../../../utils/PetUtils";
import { SmallEventPetPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventPetPacket";
import { Badge } from "../../../../../Lib/src/types/Badge";

const PET_TIME_INTERACTIONS = new Set([
	"gainTime",
	"loseTime"
]);

export default class PetSmallEventHandler {
	@packetHandler(SmallEventPetPacket)
	async smallEventPet(context: PacketContext, packet: SmallEventPetPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		const amountDisplay = packet.amount && PET_TIME_INTERACTIONS.has(packet.interactionName)
			? i18n.formatDuration(packet.amount, lng)
			: packet.amount;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"pet",
					StringUtils.getRandomTranslation(
						`smallEvents:pet.stories.${packet.interactionName}`,
						lng,
						{
							context: packet.petSex,
							pet: PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId, packet.petSex),
							amount: packet.amount,
							amountDisplay,
							food: packet.food ? DisplayUtils.getFoodDisplay(packet.food, 1, lng, false) : null,
							badge: CrowniclesIcons.badges[Badge.LEGENDARY_PET],
							randomAnimal: i18n.t("smallEvents:pet.randomAnimal", {
								lng,
								context: packet.randomPetSex,
								randomAnimal: PetUtils.petToShortString(lng, undefined, packet.randomPetTypeId, packet.randomPetSex)
							})
						}
					),
					interaction.user,
					lng
				)
			]
		});
	}
}
