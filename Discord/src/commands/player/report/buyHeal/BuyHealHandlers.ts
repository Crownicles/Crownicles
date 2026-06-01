import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandReportBuyHealAcceptPacketRes } from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { ReactionCollectorBuyHealPacket } from "../../../../../../Lib/src/packets/interaction/ReactionCollectorBuyHeal";
import { DiscordCache } from "../../../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { ReactionCollectorReturnTypeOrNull } from "../../../../packetHandlers/handlers/ReactionCollectorHandlers";
import { createConfirmationCollector } from "../../../../utils/ReportConfirmationCollector";
import { escapeUsername } from "../../../../utils/StringUtils";

export async function handleBuyHealAccept(packet: CommandReportBuyHealAcceptPacketRes, context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = interaction.userLanguage;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.healSuccessTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.healSuccessDescription", {
			lng,
			price: packet.healPrice,
			nextStep: packet.isArrived
				? i18n.t("commands:report.healNextStepArrived", { lng })
				: i18n.t("commands:report.healNextStepSmallEvent", { lng })
		}));

	await buttonInteraction?.editReply({ embeds: [embed] });
}

export async function handleBuyHealRefuse(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = interaction.userLanguage;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.healRefusedTitle", {
			lng,
			pseudo: escapeUsername(interaction.user.displayName)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.healRefusedDescription", { lng }))
		.setErrorColor();

	await buttonInteraction?.editReply({ embeds: [embed] });
}

export async function handleBuyHealNoAlteration(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = interaction.userLanguage;

	await buttonInteraction?.editReply({
		content: i18n.t("commands:report.healNoAlteration", { lng })
	});
}

export async function handleBuyHealCannotHealOccupied(context: PacketContext): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	const lng = interaction.userLanguage;

	await buttonInteraction?.editReply({
		content: i18n.t("commands:report.healCannotHealOccupied", { lng })
	});
}

export async function createBuyHealCollector(context: PacketContext, packet: ReactionCollectorBuyHealPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const data = packet.data.data;

	return await createConfirmationCollector(context, packet, {
		titleKey: "commands:report.buyHealConfirmTitle",
		descriptionKey: "commands:report.buyHealConfirmDescription",
		descriptionParams: {
			price: data.healPrice,
			playerMoney: data.playerMoney
		}
	});
}
