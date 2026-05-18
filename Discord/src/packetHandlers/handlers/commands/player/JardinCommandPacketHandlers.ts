import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandJardinClosedRes, CommandJardinNoAccessRes, JardinNoAccessReason
} from "../../../../../../Lib/src/packets/commands/CommandJardinPacket";
import { DiscordCache } from "../../../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { escapeUsername } from "../../../../utils/StringUtils";

const REASON_TO_I18N_KEY: Record<JardinNoAccessReason, string> = {
	[JardinNoAccessReason.NO_HOME]: "commands:jardin.noAccess.noHome",
	[JardinNoAccessReason.NO_GARDEN]: "commands:jardin.noAccess.noGarden",
	[JardinNoAccessReason.NO_TALISMAN]: "commands:jardin.noAccess.noTalisman"
};

export default class JardinCommandPacketHandlers {
	@packetHandler(CommandJardinClosedRes)
	async closed(context: PacketContext, _packet: CommandJardinClosedRes): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const embed = new CrowniclesEmbed()
			.formatAuthor(i18n.t("commands:jardin.title", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}), interaction.user)
			.setDescription(i18n.t("commands:jardin.closed", { lng }));
		await interaction.followUp({ embeds: [embed] });
	}

	@packetHandler(CommandJardinNoAccessRes)
	async noAccess(context: PacketContext, packet: CommandJardinNoAccessRes): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const embed = new CrowniclesEmbed()
			.formatAuthor(i18n.t("commands:jardin.title", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}), interaction.user)
			.setDescription(i18n.t(REASON_TO_I18N_KEY[packet.reason], { lng }));
		await interaction.editReply({ embeds: [embed] });
	}
}
