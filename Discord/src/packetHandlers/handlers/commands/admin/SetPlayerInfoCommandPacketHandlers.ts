import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import {
	CommandSetPlayerInfoDoesntExistError,
	CommandSetPlayerInfoRes
} from "../../../../../../Lib/src/packets/commands/CommandSetPlayerInfo";
import { DiscordCache } from "../../../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { handleClassicError } from "../../../../utils/ErrorUtils";
import { escapeUsername } from "../../../../utils/StringUtils";
import { DisplayUtils } from "../../../../utils/DisplayUtils";

export default class SetPlayerInfoCommandPacketHandlers {
	@packetHandler(CommandSetPlayerInfoRes)
	async setPlayerInfoRes(context: PacketContext, packet: CommandSetPlayerInfoRes): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);

		if (!interaction) {
			return;
		}

		const lng = interaction.userLanguage;

		await interaction.editReply({
			embeds: [
				new CrowniclesEmbed()
					.setTitle(i18n.t("commands:setPlayerInfo.playerModifiedTitle", {
						lng,
						pseudo: escapeUsername(interaction.user.displayName)
					}))
					.setDescription(i18n.t("commands:setPlayerInfo.playerModifiedDesc", {
						lng,
						keycloakId: packet.keycloakId,
						pseudo: await DisplayUtils.getEscapedUsername(packet.keycloakId, lng)
					}))
			],
			components: []
		});
	}

	@packetHandler(CommandSetPlayerInfoDoesntExistError)
	async setPlayerInfoDoesntExistError(context: PacketContext, _packet: CommandSetPlayerInfoDoesntExistError): Promise<void> {
		await handleClassicError(context, "error:playerDoesntExist");
	}
}
