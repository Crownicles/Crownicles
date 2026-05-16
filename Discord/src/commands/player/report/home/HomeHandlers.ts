import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportApartmentBuyRes,
	CommandReportApartmentClaimRentRes,
	CommandReportBuyHomeRes,
	CommandReportHomeBedRes,
	CommandReportMoveHomeRes,
	CommandReportUpgradeHomeRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { MessagesUtils } from "../../../../utils/MessagesUtils";

export async function handleBuyHome(packet: CommandReportBuyHomeRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}

	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.homes.buyHomeTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.homes.buyHomeDescription", {
			lng,
			cost: packet.cost
		}));

	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleUpgradeHome(packet: CommandReportUpgradeHomeRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}

	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.homes.upgradeHomeTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.homes.upgradeHomeDescription", {
			lng,
			cost: packet.cost
		}));

	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleMoveHome(packet: CommandReportMoveHomeRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}

	const lng = context.discord!.language;

	const rentDeducted = packet.rentDeducted ?? 0;
	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.homes.moveHomeTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t(rentDeducted > 0 ? "commands:report.city.homes.moveHomeDescriptionWithRent" : "commands:report.city.homes.moveHomeDescription", {
			lng,
			cost: packet.cost,
			rentDeducted
		}));

	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleHomeBed(packet: CommandReportHomeBedRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.homes.bed.restTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.homes.bed.restDescription", {
			lng,
			health: packet.health
		}));

	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleApartmentBuy(packet: CommandReportApartmentBuyRes, context: PacketContext): Promise<void> {
	await sendApartmentNotaryEmbed({
		context,
		titleKey: "commands:report.city.homes.apartmentNotary.buyTitle",
		descriptionKey: "commands:report.city.homes.apartmentNotary.buyDescription",
		descriptionParams: {
			cost: packet.cost,
			mapLocationId: packet.mapLocationId
		}
	});
}

export async function handleApartmentClaimRent(packet: CommandReportApartmentClaimRentRes, context: PacketContext): Promise<void> {
	await sendApartmentNotaryEmbed({
		context,
		titleKey: "commands:report.city.homes.apartmentNotary.claimTitle",
		descriptionKey: "commands:report.city.homes.apartmentNotary.claimDescription",
		descriptionParams: {
			rent: packet.rentClaimed,
			mapLocationId: packet.mapLocationId
		}
	});
}

async function sendApartmentNotaryEmbed(params: {
	context: PacketContext;
	titleKey: string;
	descriptionKey: string;
	descriptionParams: Record<string, number | string>;
}): Promise<void> {
	const {
		context, titleKey, descriptionKey, descriptionParams
	} = params;
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t(titleKey, {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t(descriptionKey, {
			lng, ...descriptionParams
		}));

	await interaction.editReply({
		embeds: [embed]
	});
}
