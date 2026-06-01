import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandGardenClosedRes, CommandGardenNoAccessRes, GardenNoAccessReason
} from "../../../../../../Lib/src/packets/commands/CommandGardenPacket";
import { DiscordCache } from "../../../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { escapeUsername } from "../../../../utils/StringUtils";

const REASON_TO_I18N_KEY: Record<GardenNoAccessReason, string> = {
	[GardenNoAccessReason.NO_HOME]: "commands:garden.noAccess.noHome",
	[GardenNoAccessReason.NO_GARDEN]: "commands:garden.noAccess.noGarden",
	[GardenNoAccessReason.NO_TALISMAN]: "commands:garden.noAccess.noTalisman"
};

export default class GardenCommandPacketHandlers {
	@packetHandler(CommandGardenClosedRes)
	async closed(context: PacketContext, _packet: CommandGardenClosedRes): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const embed = new CrowniclesEmbed()
			.formatAuthor(i18n.t("commands:garden.title", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}), interaction.user)
			.setDescription(i18n.t("commands:garden.closed", { lng }));
		await interaction.followUp({ embeds: [embed] });
	}

	@packetHandler(CommandGardenNoAccessRes)
	async noAccess(context: PacketContext, packet: CommandGardenNoAccessRes): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const embed = new CrowniclesEmbed()
			.formatAuthor(i18n.t("commands:garden.title", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}), interaction.user)
			.setDescription(i18n.t(REASON_TO_I18N_KEY[packet.reason], { lng }));
		await interaction.editReply({ embeds: [embed] });
	}
}
