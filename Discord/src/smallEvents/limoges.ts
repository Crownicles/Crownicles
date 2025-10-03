import { ReactionCollectorCreationPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { ReactionCollectorLimogesData } from "../../../Lib/src/packets/interaction/ReactionCollectorLimoges";
import i18n from "../translations/i18n";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { getRandomSmallEventIntro } from "../packetHandlers/handlers/SmallEventsHandler";
import { DiscordCollectorUtils } from "../utils/DiscordCollectorUtils";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";

export async function limogesCollector(context: PacketContext, packet: ReactionCollectorCreationPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return null;
	}
	const data = packet.data.data as ReactionCollectorLimogesData;
	const lng = interaction.userLanguage;

	const intro = getRandomSmallEventIntro(lng);
	const story = i18n.t(`smallEvents:limoges.stories.${data.factKey}`, { lng });
	const question = i18n.t(`smallEvents:limoges.questions.${data.questionId}`, { lng });
	const description = `${intro}${story}\n\n${question}`;

	const embed = new CrowniclesSmallEventEmbed(
		"limoges",
		description,
		interaction.user,
		lng
	);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}
