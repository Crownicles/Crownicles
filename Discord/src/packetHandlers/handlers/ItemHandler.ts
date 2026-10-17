import { packetHandler } from "../PacketHandler";
import { ItemAcceptPacket } from "../../../../Lib/src/packets/events/ItemAcceptPacket";
import { PacketContext } from "../../../../Lib/src/packets/CrowniclesPacket";
import { ItemFoundPacket } from "../../../../Lib/src/packets/events/ItemFoundPacket";
import { ItemRefusePacket } from "../../../../Lib/src/packets/events/ItemRefusePacket";
import { DiscordCache } from "../../bot/DiscordCache";
import { CrowniclesEmbed } from "../../messages/CrowniclesEmbed";
import i18n from "../../translations/i18n";
import { DisplayUtils } from "../../utils/DisplayUtils";
import { ItemCategory } from "../../../../Lib/src/constants/ItemConstants";
import { escapeUsername } from "../../utils/StringUtils";

export default class ItemHandler {
	@packetHandler(ItemAcceptPacket)
	async itemAcceptHandler(context: PacketContext, packet: ItemAcceptPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		const menuEmbed = new CrowniclesEmbed()
			.formatAuthor(i18n.t("commands:inventory.acceptedTitle", {
				lng,
				pseudo: escapeUsername(interaction.user.displayName)
			}), interaction.user)
			.setDescription(DisplayUtils.getItemDisplayWithStats(packet.itemWithDetails, lng));
		await interaction.channel.send({ embeds: [menuEmbed] });
	}

	@packetHandler(ItemFoundPacket)
	async itemFoundHandler(context: PacketContext, packet: ItemFoundPacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);
		if (!interaction) {
			return;
		}
		const lng = interaction.userLanguage;
		await interaction.channel.send({
			embeds: [
				new CrowniclesEmbed()
					.formatAuthor(i18n.t("commands:inventory.randomItemTitle", {
						lng,
						pseudo: escapeUsername(interaction.user.displayName)
					}), interaction.user)
					.setDescription(DisplayUtils.getItemDisplayWithStats(packet.itemWithDetails, lng))
			]
		});
	}

	@packetHandler(ItemRefusePacket)
	async itemRefuseHandler(context: PacketContext, packet: ItemRefusePacket): Promise<void> {
		const interaction = DiscordCache.getInteraction(context.discord!.interaction);

		if (!interaction) {
			return;
		}

		const menuEmbed = new CrowniclesEmbed();
		const lng = interaction.userLanguage;
		if (packet.item.category !== ItemCategory.POTION) {
			menuEmbed
				.formatAuthor(
					packet.autoSell
						? i18n.t("commands:sell.soldMessageAlreadyOwnTitle", {
							lng,
							pseudo: escapeUsername(interaction.user.displayName)
						})
						: i18n.t("commands:sell.soldMessageTitle", {
							lng,
							pseudo: escapeUsername(interaction.user.displayName)
						}),
					interaction.user
				)
				.setDescription(i18n.t("commands:sell.soldMessage", {
					lng,
					item: DisplayUtils.getSimpleItemDisplay(packet.item, lng),
					value: packet.soldMoney
				}));
		}
		else {
			menuEmbed
				.formatAuthor(
					packet.autoSell
						? i18n.t("commands:sell.soldMessageAlreadyOwnTitle", {
							lng,
							pseudo: escapeUsername(interaction.user.displayName)
						})
						: i18n.t("commands:sell.potionDestroyedTitle", {
							lng,
							pseudo: escapeUsername(interaction.user.displayName)
						}),
					interaction.user
				)
				.setDescription(i18n.t("commands:sell.potionDestroyedMessage", {
					lng,
					item: DisplayUtils.getSimpleItemDisplay(packet.item, lng)
				}));
		}

		const buttonInteraction = context.discord!.buttonInteraction ? DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!) : null;
		if (buttonInteraction && !buttonInteraction.replied) {
			await buttonInteraction.editReply({ embeds: [menuEmbed] });
		}
		else {
			await interaction.channel.send({ embeds: [menuEmbed] });
		}
	}
}
