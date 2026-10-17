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

/**
 * Send a standard "report city home" embed reply with a translated title and
 * description. All home/apartment report handlers share this layout (author
 * line built from the player pseudo, then a description with packet data),
 * so the per-handler code is reduced to picking translation keys.
 */
export async function sendHomeReportEmbed(params: {
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

/**
 * Static report descriptor: a fixed title key + description key, with the
 * description params derived from the packet payload. Used to centralize the
 * trivial home/apartment report handlers that all share the same layout.
 */
type HomeReportDescriptor<P> = {
	titleKey: string;
	descriptionKey: string;
	descriptionParams: (packet: P) => Record<string, number | string>;
};

export const HOME_REPORT_DESCRIPTORS = {
	buyHome: {
		titleKey: "commands:report.city.homes.buyHomeTitle",
		descriptionKey: "commands:report.city.homes.buyHomeDescription",
		descriptionParams: (packet: CommandReportBuyHomeRes): Record<string, number | string> => ({ cost: packet.cost })
	} satisfies HomeReportDescriptor<CommandReportBuyHomeRes>,
	upgradeHome: {
		titleKey: "commands:report.city.homes.upgradeHomeTitle",
		descriptionKey: "commands:report.city.homes.upgradeHomeDescription",
		descriptionParams: (packet: CommandReportUpgradeHomeRes): Record<string, number | string> => ({ cost: packet.cost })
	} satisfies HomeReportDescriptor<CommandReportUpgradeHomeRes>,
	apartmentBuy: {
		titleKey: "commands:report.city.homes.apartmentNotary.buyTitle",
		descriptionKey: "commands:report.city.homes.apartmentNotary.buyDescription",
		descriptionParams: (packet: CommandReportApartmentBuyRes): Record<string, number | string> => ({
			cost: packet.cost, mapLocationId: packet.mapLocationId
		})
	} satisfies HomeReportDescriptor<CommandReportApartmentBuyRes>,
	apartmentClaimRent: {
		titleKey: "commands:report.city.homes.apartmentNotary.claimTitle",
		descriptionKey: "commands:report.city.homes.apartmentNotary.claimDescription",
		descriptionParams: (packet: CommandReportApartmentClaimRentRes): Record<string, number | string> => ({
			rent: packet.rentClaimed, mapLocationId: packet.mapLocationId
		})
	} satisfies HomeReportDescriptor<CommandReportApartmentClaimRentRes>,
	homeBed: {
		titleKey: "commands:report.city.homes.bed.restTitle",
		descriptionKey: "commands:report.city.homes.bed.restDescription",
		descriptionParams: (packet: CommandReportHomeBedRes): Record<string, number | string> => ({ health: packet.health })
	} satisfies HomeReportDescriptor<CommandReportHomeBedRes>
} as const;

export async function sendHomeReport<P>(
	descriptor: HomeReportDescriptor<P>,
	packet: P,
	context: PacketContext
): Promise<void> {
	await sendHomeReportEmbed({
		context,
		titleKey: descriptor.titleKey,
		descriptionKey: descriptor.descriptionKey,
		descriptionParams: descriptor.descriptionParams(packet)
	});
}

export async function handleMoveHome(packet: CommandReportMoveHomeRes, context: PacketContext): Promise<void> {
	const rentDeducted = packet.rentDeducted ?? 0;
	await sendHomeReportEmbed({
		context,
		titleKey: "commands:report.city.homes.moveHomeTitle",
		descriptionKey: rentDeducted > 0
			? "commands:report.city.homes.moveHomeDescriptionWithRent"
			: "commands:report.city.homes.moveHomeDescription",
		descriptionParams: {
			cost: packet.cost,
			rentDeducted
		}
	});
}
