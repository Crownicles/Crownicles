import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandReportEatInnMealRes,
	CommandReportSleepRoomRes
} from "../../../../../../Lib/src/packets/commands/CommandReportPacket";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { DisplayUtils } from "../../../../utils/DisplayUtils";
import { MessagesUtils } from "../../../../utils/MessagesUtils";

export async function handleEatInnMeal(packet: CommandReportEatInnMealRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.inns.eatMealTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(i18n.t("commands:report.city.inns.eatMealDescription", {
			lng,
			energy: packet.energy,
			price: packet.moneySpent
		}));

	await interaction.editReply({
		embeds: [embed]
	});
}

export async function handleInnRoom(packet: CommandReportSleepRoomRes, context: PacketContext): Promise<void> {
	const interaction = MessagesUtils.getCurrentInteraction(context);
	if (!interaction) {
		return;
	}
	const lng = context.discord!.language;

	const embed = new CrowniclesEmbed()
		.formatAuthor(i18n.t("commands:report.city.inns.roomTitle", {
			lng,
			pseudo: await DisplayUtils.getEscapedUsername(context.keycloakId!, lng)
		}), interaction.user)
		.setDescription(`${i18n.t(`commands:report.city.inns.roomsStories.${packet.roomId}`, {
			lng
		})}\n\n${i18n.t("commands:report.city.inns.roomEndStory", {
			lng,
			health: packet.health,
			price: packet.moneySpent
		})}`);

	await interaction.editReply({
		embeds: [embed]
	});
}
