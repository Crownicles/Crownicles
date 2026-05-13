import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportGuildDomainNotEnoughTreasuryRes,
	CommandReportGuildDomainPurchaseRes,
	CommandReportGuildDomainRelocateRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { MessagesUtils } from "../../../../utils/MessagesUtils";

export async function handleGuildDomainPurchase(packet: CommandReportGuildDomainPurchaseRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.guildDomain.purchaseTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.guildDomain.purchaseDescription", {
			lng,
			cost: packet.cost
		}));

	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleGuildDomainRelocate(packet: CommandReportGuildDomainRelocateRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.guildDomain.relocateTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.guildDomain.relocateDescription", {
			lng,
			cost: packet.cost
		}));

	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleGuildDomainNotEnoughTreasury(packet: CommandReportGuildDomainNotEnoughTreasuryRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.guildDomain.notEnoughTreasuryTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.guildDomain.notEnoughTreasuryDescription", {
			lng,
			missingTreasury: packet.missingTreasury
		}));

	await interaction.editReply({
		embeds: [embed]
	});
}
