import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { SmallEventMessagePacket } from "../../../Lib/src/packets/smallEvents/SmallEventMessagePacket";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { getRandomSmallEventIntro } from "../utils/SmallEventUtils";
import i18n from "../translations/i18n";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import { SmallEventConstants } from "../../../Lib/src/constants/SmallEventConstants";

export async function messageHandler(context: PacketContext, packet: SmallEventMessagePacket): Promise<void> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return;
	}
	const lng = interaction.userLanguage;
	const destinationName = i18n.t(`models:map_locations.${packet.destinationLocationId}.name`, { lng });

	if (packet.interactionName === SmallEventConstants.MESSAGE.INTERACTIONS.ALREADY_ACTIVE) {
		await interaction.editReply({
			embeds: [
				new CrowniclesSmallEventEmbed(
					"message",
					getRandomSmallEventIntro(lng) + i18n.t("smallEvents:message.alreadyActive", {
						lng,
						destination: destinationName
					}),
					interaction.user,
					lng
				)
			]
		});
		return;
	}

	const secretEmojiDisplay = packet.secretEmoji ? (CrowniclesIcons.messageEmojis[packet.secretEmoji] ?? packet.secretEmoji) : "";

	const reply = await interaction.editReply({
		embeds: [
			new CrowniclesSmallEventEmbed(
				"message",
				getRandomSmallEventIntro(lng) + i18n.t("smallEvents:message.intro", {
					lng,
					destination: destinationName,
					emoji: secretEmojiDisplay
				}),
				interaction.user,
				lng
			)
		]
	});

	if (reply && packet.vanishAfterMs) {
		setTimeout(async () => {
			try {
				await interaction.editReply({
					embeds: [
						new CrowniclesSmallEventEmbed(
							"message",
							getRandomSmallEventIntro(lng) + i18n.t("smallEvents:message.introVanished", {
								lng,
								destination: destinationName
							}),
							interaction.user,
							lng
						)
					]
				});
			}
			catch {
				// Message or interaction expired/deleted
			}
		}, packet.vanishAfterMs);
	}
}
