import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { MessagesUtils } from "../../../utils/MessagesUtils";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import {
	SexTypeShort, StringConstants
} from "../../../../../Lib/src/constants/StringConstants";
import { PetUtils } from "../../../utils/PetUtils";
import { SmallEventBadPetPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventBadPetPacket";

export default class BadPetSmallEventHandler {
	@packetHandler(SmallEventBadPetPacket)
	async smallEventBadPet(context: PacketContext, packet: SmallEventBadPetPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = context.discord!.language;

		const petDisplay = PetUtils.petToShortString(lng, packet.petNickname, packet.petId, packet.sex as SexTypeShort);

		// Get the sex context for gendered translations
		const sexContext = packet.sex === StringConstants.SEX.MALE.short
			? StringConstants.SEX.MALE.long
			: StringConstants.SEX.FEMALE.long;

		const outcomeKey = packet.loveLost === 0 ? "success" : "fail";
		const description = StringUtils.getRandomTranslation(
			`smallEvents:badPet.outcomes.${packet.interactionType}.${outcomeKey}`,
			lng,
			{
				pet: petDisplay, context: sexContext
			}
		);

		const embed = new CrowniclesSmallEventEmbed(
			"badPet",
			description,
			MessagesUtils.getClickUser(context) ?? interaction.user,
			lng
		);

		await MessagesUtils.editClickReply(context, {
			embeds: [embed], components: []
		});
	}
}
