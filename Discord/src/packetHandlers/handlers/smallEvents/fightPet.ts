import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import i18n from "../../../translations/i18n";
import { SmallEventFightPetPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventFightPetPacket";
import { StringConstants } from "../../../../../Lib/src/constants/StringConstants";

export default class FightPetSmallEventHandler {
	@packetHandler(SmallEventFightPetPacket)
	async smallEventFightPet(context: PacketContext, packet: SmallEventFightPetPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;

		// Get the sex context for gendered translations
		const sexContext = packet.isFemale ? StringConstants.SEX.FEMALE.long : StringConstants.SEX.MALE.long;
		await interaction.followUp({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"fightPet",
					i18n.t(`smallEvents:fightPet.fightPetActions.${packet.fightPetActionId}.${packet.isSuccess ? "success" : "failure"}`, {
						lng, context: sexContext
					})
					+ (packet.isSuccess
						? i18n.t("smallEvents:fightPet.rageUpFormat", {
							lng,
							rageUpDescription: StringUtils.getRandomTranslation("smallEvents:fightPet.rageUpDescriptions", lng)
						})
						: ""),
					interaction.user,
					lng
				)
			]
		});
	}
}
