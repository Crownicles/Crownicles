import { packetHandler } from "../../../PacketHandler";
import {
	PacketContext, makePacket
} from "../../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandBlessingPacketRes } from "../../../../../../Lib/src/packets/commands/CommandBlessingPacketRes";
import { CommandBlessingClaimDailyPacketReq } from "../../../../../../Lib/src/packets/commands/CommandBlessingClaimDailyPacketReq";
import { CommandBlessingClaimDailyPacketRes } from "../../../../../../Lib/src/packets/commands/CommandBlessingClaimDailyPacketRes";
import { DiscordCache } from "../../../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../../../messages/CrowniclesEmbed";
import i18n from "../../../../translations/i18n";
import { escapeUsername } from "../../../../utils/StringUtils";
import { BlessingType } from "../../../../../../Lib/src/constants/BlessingConstants";
import { KeycloakUtils } from "../../../../../../Lib/src/keycloak/KeycloakUtils";
import { keycloakConfig } from "../../../../bot/CrowniclesShard";
import { CrowniclesIcons } from "../../../../../../Lib/src/CrowniclesIcons";
import { printTimeBeforeDate } from "../../../../../../Lib/src/utils/TimeUtils";
import {
	ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Message
} from "discord.js";
import { PacketUtils } from "../../../../utils/PacketUtils";
import { sendInteractionNotForYou } from "../../../../utils/ErrorUtils";
import { Constants } from "../../../../../../Lib/src/constants/Constants";

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

		const embed = new CrowniclesEmbed()
			.formatAuthor(i18n.t("commands:blessing.title", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}), interaction.user)
			.setDescription(description);

		// Add claim daily bonus button if available
		if (packet.canClaimDailyBonus) {
			const row = new ActionRowBuilder<ButtonBuilder>();
			row.addComponents(
				new ButtonBuilder()
					.setCustomId("claimDailyBonus")
					.setLabel(i18n.t("commands:blessing.claimDailyButton", { lng }))
					.setStyle(ButtonStyle.Success)
			);

			const msg = await interaction.editReply({
				embeds: [embed],
				components: [row]
			}) as Message;

			const buttonCollector = msg.createMessageComponentCollector({
				time: Constants.MESSAGES.COLLECTOR_TIME
			});

			buttonCollector.on("collect", async (buttonInteraction: ButtonInteraction) => {
				if (buttonInteraction.user.id !== context.discord?.user) {
					await sendInteractionNotForYou(buttonInteraction.user, buttonInteraction, lng);
					return;
				}

				row.components.forEach(button => button.setDisabled(true));
				await buttonInteraction.update({ components: [row] });

				// Send claim request to Core
				PacketUtils.sendPacketToBackend(context, makePacket(CommandBlessingClaimDailyPacketReq, {}));
				buttonCollector.stop();
			});

			buttonCollector.on("end", async () => {
				row.components.forEach(button => button.setDisabled(true));
				await msg.edit({ components: [row] }).catch(() => null);
			});
		}
		else {
			await interaction.editReply({ embeds: [embed] });
		}
	}

	@packetHandler(CommandBlessingClaimDailyPacketRes)
	async claimDailyRes(context: PacketContext, packet: CommandBlessingClaimDailyPacketRes): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}

		const lng = interaction.userLanguage;

		if (!packet.success) {
			await interaction.followUp({
				embeds: [
					new CrowniclesEmbed()
						.setErrorColor()
						.setDescription(i18n.t("commands:blessing.claimDailyFailed", { lng }))
				]
			});
			return;
		}

		await interaction.followUp({
			embeds: [
				new CrowniclesEmbed()
					.setDescription(i18n.t("commands:blessing.claimDailySuccess", {
						lng,
						gemsWon: packet.gemsWon,
						xpWon: packet.xpWon,
						moneyWon: packet.moneyWon,
						pointsWon: packet.pointsWon,
						moneyEmote: CrowniclesIcons.unitValues.money,
						xpEmote: CrowniclesIcons.unitValues.experience,
						gemsEmote: CrowniclesIcons.unitValues.gems,
						pointsEmote: CrowniclesIcons.unitValues.score
					}))
			]
		});
	}
}
