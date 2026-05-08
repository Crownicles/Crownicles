import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { DiscordCollectorUtils } from "../utils/DiscordCollectorUtils";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../utils/StringUtils";
import { getRandomSmallEventIntro } from "../utils/SmallEventUtils";
import {
	ReactionCollectorGardenerPacket
} from "../../../Lib/src/packets/interaction/ReactionCollectorGardener";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";

export async function gardenerCollector(context: PacketContext, packet: ReactionCollectorGardenerPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction!.userLanguage;
	const data = packet.data.data;

	const embed = new CrowniclesSmallEventEmbed(
		"gardener",
		getRandomSmallEventIntro(lng)
		+ StringUtils.getRandomTranslation("smallEvents:gardener.stories", lng)
		+ StringUtils.getRandomTranslation("smallEvents:gardener.rewards.seed.paid", lng, {
			cost: data.cost
		})
		+ StringUtils.getRandomTranslation("smallEvents:gardener.menu", lng),
		interaction.user,
		lng
	);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}
