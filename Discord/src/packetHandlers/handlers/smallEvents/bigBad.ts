import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../../../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../../../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../../../utils/StringUtils";
import { getRandomSmallEventIntro } from "../../../utils/SmallEventUtils";
import { SmallEventBigBadPacket } from "../../../../../Lib/src/packets/smallEvents/SmallEventBigBadPacket";
import { SmallEventBigBadKind } from "../../../../../Lib/src/types/SmallEventBigBadKind";
import i18n from "../../../translations/i18n";
import { CrowniclesIcons } from "../../../../../Lib/src/CrowniclesIcons";

export default class BigBadSmallEventHandler {
	@packetHandler(SmallEventBigBadPacket)
	async smallEventBigBad(context: PacketContext, packet: SmallEventBigBadPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		let story: string;
		switch (packet.kind) {
			case SmallEventBigBadKind.LIFE_LOSS:
				story = StringUtils.getRandomTranslation("smallEvents:bigBad.lifeLoss", lng, { lifeLoss: packet.lifeLost });
				break;
			case SmallEventBigBadKind.ALTERATION:
				story = `${i18n.t(`smallEvents:bigBad.alterationStories.${packet.receivedStory}`, { lng })} ${CrowniclesIcons.effects[packet.effectId!]}`;
				break;
			case SmallEventBigBadKind.MONEY_LOSS:
				story = StringUtils.getRandomTranslation("smallEvents:bigBad.moneyLoss", lng, { moneyLost: packet.moneyLost });
				break;
			default:
				story = "";
		}
		const description = getRandomSmallEventIntro(lng) + story;
		await interaction.editReply({ embeds: [new CrowniclesSmallEventEmbed("bigBad", description, interaction.user, lng)] });
	}
}
