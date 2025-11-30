import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { ReactionCollectorGoToPVEIslandData } from "../../../Lib/src/packets/interaction/ReactionCollectorGoToPVEIsland";
import i18n from "../translations/i18n";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { getRandomSmallEventIntro } from "../utils/SmallEventUtils";
import { StringUtils } from "../utils/StringUtils";
import { DiscordCollectorUtils } from "../utils/DiscordCollectorUtils";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";

export async function goToPVEIslandCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const data = packet.data.data as ReactionCollectorGoToPVEIslandData;
	const lng = interaction!.userLanguage;

	const embed = new CrowniclesSmallEventEmbed(
		"goToPVEIsland",
		`${getRandomSmallEventIntro(lng)
		+ StringUtils.getRandomTranslation(
			"smallEvents:goToPVEIsland.stories",
			lng,
			{
				priceText: i18n.t(`smallEvents:goToPVEIsland.price${data.price === 0 ? "Free" : "Money"}`, {
					lng,
					price: data.price
				})
			}
		)}\n\n${i18n.t("smallEvents:goToPVEIsland.confirm", {
			lng,
			energy: data.energy.current,
			energyMax: data.energy.max
		})}`,
		interaction.user,
		lng
	);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}
