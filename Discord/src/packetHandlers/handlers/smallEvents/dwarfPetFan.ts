import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import i18n from "../../../translations/i18n";
import { PetUtils } from "../../../utils/PetUtils";
import { SmallEventDwarfPetFanPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventDwarfPetFanPacket";

export default class DwarfPetFanSmallEventHandler {
	@packetHandler(SmallEventDwarfPetFanPacket)
	async smallEventDwarfPetFan(context: PacketContext, packet: SmallEventDwarfPetFanPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		const lng = interaction!.userLanguage;
		const keyReward = packet.isGemReward ? "gem" : "money";
		const hasPetInfo = packet.petTypeId !== undefined;
		await interaction?.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"dwarfPetFan",
					`${StringUtils.getRandomTranslation("smallEvents:dwarfPetFan.intro", lng)} ${StringUtils.getRandomTranslation(`smallEvents:dwarfPetFan.${packet.interactionName}`, lng, {
						...hasPetInfo ? { context: packet.petSex } : {},
						pet: hasPetInfo ? PetUtils.petToShortString(lng, packet.petNickname, packet.petTypeId!, packet.petSex!) : "",
						reward: packet.amount !== undefined
							? i18n.t(`smallEvents:dwarfPetFan.reward.${keyReward}`, {
								lng, amount: packet.amount
							})
							: ""
					})}`,
					interaction.user,
					lng
				)
			]
		});
	}
}
