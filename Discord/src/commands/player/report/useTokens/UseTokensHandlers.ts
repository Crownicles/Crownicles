import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportUseTokensAcceptPacketRes } from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { ReactionCollectorUseTokensPacket } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorUseTokens";
import { DiscordCache } from "../../../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { ReactionCollectorReturnTypeOrNull } from "../../../../packetHandlers/handlers/ReactionCollectorHandlers";
import { createConfirmationCollector } from "../../../../utils/ReportConfirmationCollector";
import { escapeUsername } from "../../../../utils/StringUtils";

export async function handleUseTokensAccept(packet: CommandReportUseTokensAcceptPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = interaction.userLanguage;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.tokensUsedSuccessTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.tokensUsedSuccessDescription", {
			lng,
			count: packet.tokensSpent,
			nextStep: packet.isArrived
				? i18n.t("commands:report.tokensNextStepArrived", { lng })
				: i18n.t("commands:report.tokensNextStepSmallEvent", { lng })
		}));

	await buttonInteraction?.editReply({ embeds: [embed] });
}

export async function handleUseTokensRefuse(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = interaction.userLanguage;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.tokensUsedRefusedTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.tokensUsedRefusedDescription", { lng }))
		.setErrorColor();

	await buttonInteraction?.editReply({ embeds: [embed] });
}

export async function createUseTokensCollector(context: PacketContext, packet: ReactionCollectorUseTokensPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const data = packet.data.data;

	return await createConfirmationCollector(context, packet, {
		titleKey: "commands:report.useTokensConfirmTitle",
		descriptionKey: "commands:report.useTokensConfirmDescription",
		descriptionParams: {
			count: data.cost,
			playerTokens: data.playerTokens
		}
	});
}
