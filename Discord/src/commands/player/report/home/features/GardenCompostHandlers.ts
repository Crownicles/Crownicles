import {
	ContainerBuilder, TextDisplayBuilder
} from "discord.js";
import { PacketContext } from "../../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportGardenCompostNotEnoughPlantsRes,
	CommandReportGardenCompostRes
} from "../../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { Language } from "../../../../../../../Lib/src/Language";
import i18n from "../../../../../translations/i18n";
import { DisplayUtils } from "../../../../../utils/DisplayUtils";
import { MessagesUtils } from "../../../../../utils/MessagesUtils";
import { handleClassicError } from "../../../../../utils/ErrorUtils";
import { StringUtils } from "../../../../../utils/StringUtils";

/**
 * Render the result embed for a successful manual compost action, mirroring
 * the inn-meal handler shape: builds the player's pseudo header, lists the
 * materials produced and edits the `/rapport` reply in place.
 */
export async function handleGardenCompost(packet: CommandReportGardenCompostRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;

	const materialsList = buildMaterialsList(packet.materials, lng);

	const title = i18n.t("commands:report.city.homes.garden.compost.resultTitle", {
		lng,
		pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
	});
	const description = i18n.t("commands:report.city.homes.garden.compost.resultDescription", {
		lng,
		plantId: packet.plantId,
		quantity: packet.quantity,
		materialsList
	});

	const container = new ContainerBuilder()
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(StringUtils.formatHeader(title)))
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));

	await interaction.editReply({
		embeds: [],
		components: [container],
		flags: ["IsComponentsV2"]
	});
}

/**
 * Group the materials produced by id+count, then render one line per group.
 * Avoids spamming the result embed with duplicate lines when several plants
 * yield the same material.
 */
function buildMaterialsList(materials: number[], lng: Language): string {
	const counts = new Map<number, number>();
	for (const materialId of materials) {
		counts.set(materialId, (counts.get(materialId) ?? 0) + 1);
	}
	return Array.from(counts.entries())
		.map(([materialId, count]) => i18n.t("commands:report.city.homes.garden.compost.resultMaterialLine", {
			lng,
			materialId,
			count
		}))
		.join("\n");
}

/**
 * Inline-error renderer for the compost confirmation step: triggered when the
 * storage no longer holds enough plants (e.g. another shard composted /
 * harvested between the menu render and the confirm click).
 */
export async function handleGardenCompostNotEnoughPlants(
	packet: CommandReportGardenCompostNotEnoughPlantsRes,
	context: PacketContext
): Promise<void> {
	await handleClassicError(context, "commands:report.city.homes.garden.compost.notEnoughPlants", {
		plantId: packet.plantId,
		quantity: packet.quantity
	});
}
