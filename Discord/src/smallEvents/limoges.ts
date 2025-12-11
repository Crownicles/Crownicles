import { ReactionCollectorLimogesPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorLimoges";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import i18n from "../translations/i18n";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { getRandomSmallEventIntro } from "../utils/SmallEventUtils";
import { DiscordCollectorUtils } from "../utils/DiscordCollectorUtils";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { StringUtils } from "../utils/StringUtils";
import { SmallEventLimogesPacket } from "../../../Lib/src/packets/smallEvents/SmallEventLimogesPacket";
import { minutesDisplay } from "../../../Lib/src/utils/TimeUtils";

export async function limogesCollector(context: PacketContext, packet: ReactionCollectorLimogesPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return null;
	}
	const data = packet.data.data;
	const lng = interaction.userLanguage;

	const intro = getRandomSmallEventIntro(lng);
	const story = StringUtils.getRandomTranslation("smallEvents:limoges.stories", lng);
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

export async function limogesResult(packet: SmallEventLimogesPacket, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (!interaction) {
		return;
	}

	const lng = context.discord!.language;

	let outcome: string;
	if (packet.isSuccess) {
		if (!packet.reward) {
			throw new Error("Missing reward for successful Limoges small event outcome");
		}
		outcome = StringUtils.getRandomTranslation("smallEvents:limoges.successStories", lng, {
			experience: packet.reward.experience,
			score: packet.reward.score
		});
	}
	else if (!packet.penalty) {
		outcome = i18n.t("smallEvents:limoges.failureFallback", { lng });
	}
	else {
		const amountDisplay = packet.penalty.type === "time"
			? minutesDisplay(packet.penalty.amount, lng)
			: packet.penalty.amount;
		outcome = i18n.t(`smallEvents:limoges.penalties.${packet.penalty.type}`, {
			lng,
			amount: packet.penalty.amount,
			amountDisplay
		});
	}

	const recapKey = `smallEvents:limoges.recap.${packet.isSuccess ? "success" : "failure"}.${packet.shouldHaveAccepted ? "accept" : "refuse"}`;
	const description = `${i18n.t(recapKey, { lng })}\n\n${outcome}`;

	await interaction.editReply({
		embeds: [
			new CrowniclesSmallEventEmbed(
				"limoges",
				description,
				interaction.user,
				lng
			)
		]
	});
}
