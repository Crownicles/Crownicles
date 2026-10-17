import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import i18n from "../../../translations/i18n";
import { SmallEventStaffMemberPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventStaffMemberPacket";
import { RandomUtils } from "../../../../../Lib/src/utils/RandomUtils";

export default class StaffMemberSmallEventHandler {
	@packetHandler(SmallEventStaffMemberPacket)
	async smallEventStaffMember(context: PacketContext, _packet: SmallEventStaffMemberPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const staffMember = RandomUtils.crowniclesRandom.pick(Object.keys(i18n.tRecord("smallEvents:staffMember.members", {
			lng
		})));
		await interaction.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"staffMember",
					StringUtils.getRandomTranslation("smallEvents:staffMember.context", lng, {
						pseudo: staffMember,
						sentence: i18n.t(`smallEvents:staffMember.members.${staffMember}`, {
							lng
						})
					}),
					interaction.user,
					lng
				)
			]
		});
	}
}
