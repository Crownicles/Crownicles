import { packetHandler } from "../../../PacketHandler";
import { PacketContext } from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandBlessingPacketRes } from "../../../../../../Lib/src/packets/commands/CommandBlessingPacketRes";
import { DiscordCache } from "../../../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { escapeUsername } from "../../../../utils/StringUtils";
import { BlessingType } from "../../../../../../Lib/src/constants/BlessingConstants";
import { KeycloakUtils } from "../../../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../../../bot/CrowniclesShard";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { printTimeBeforeDate } from "../../../../../../Lib/src/utils/TimeUtils";

export default class BlessingCommandPacketHandlers {
	@packetHandler(CommandBlessingPacketRes)
	async blessingRes(context: PacketContext, packet: CommandBlessingPacketRes): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}

		const lng = interaction.userLanguage;
		const hasBlessing = packet.activeBlessingType !== BlessingType.NONE;

		let description: string;

		if (hasBlessing) {
			// Resolve the name of the player who triggered the blessing
			let triggeredByName = i18n.t("error:unknownPlayer", { lng });
			if (packet.lastTriggeredByKeycloakId) {
				const getUser = await KeycloakUtils.getUserByKeycloakId(keycloakConfig, packet.lastTriggeredByKeycloakId);
				if (!getUser.isError && getUser.payload.user.attributes.gameUsername) {
					triggeredByName = escapeUsername(getUser.payload.user.attributes.gameUsername[0]);
				}
			}

			description = i18n.t("commands:blessing.active", {
				lng,
				blessingName: i18n.t(`commands:blessing.blessingNames.${packet.activeBlessingType}`, { lng }),
				blessingEffect: i18n.t(`commands:blessing.blessingEffects.${packet.activeBlessingType}`, { lng }),
				timeLeft: printTimeBeforeDate(packet.blessingEndAt),
				triggeredBy: triggeredByName,
				moneyEmote: CrowniclesIcons.unitValues.money
			});
		}
		else {
			description = i18n.t("commands:blessing.collecting", {
				lng,
				poolAmount: packet.poolAmount,
				poolThreshold: packet.poolThreshold,
				moneyEmote: CrowniclesIcons.unitValues.money,
				percentage: Math.floor(packet.poolAmount / packet.poolThreshold * 100)
			});
		}

		await interaction.editReply({
			embeds: [
				new CrowniclesEmbed()
					.formatAuthor(i18n.t("commands:blessing.title", {
						lng,
						pseudo: escapeUsername(interaction.user.displayName)
					}), interaction.user)
					.setDescription(description)
			]
		});
	}
}
