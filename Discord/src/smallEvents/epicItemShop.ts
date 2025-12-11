import { ReactionCollectorEpicShopSmallEventPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorEpicShopSmallEvent";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../utils/StringUtils";
import { DiscordCollectorUtils } from "../utils/DiscordCollectorUtils";
import { DisplayUtils } from "../utils/DisplayUtils";
import i18n from "../translations/i18n";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";

/**
 * Send the initial embed for this small event
 * @param packet
 * @param context
 */
export async function epicItemShopCollector(context: PacketContext, packet: ReactionCollectorEpicShopSmallEventPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;
	const data = packet.data.data;
	const tip = data.tip ? i18n.t("smallEvents:epicItemShop.reductionTip", { lng }) : "";

	const embed = new CrowniclesSmallEventEmbed(
		"epicItemShop",
		StringUtils.getRandomTranslation("smallEvents:epicItemShop.intro", lng)
		+ tip
		+ StringUtils.getRandomTranslation("smallEvents:shop.end", lng, {
			item: DisplayUtils.getItemDisplayWithStats(data.item, lng),
			price: data.price,
			type: `${CrowniclesIcons.itemCategories[data.item.category]}${i18n.t("smallEvents:shop.types", {
				returnObjects: true,
				lng
			})[data.item.category]}`
		}),
		interaction.user,
		lng
	);

	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}

export async function epicItemShopHandler(context: PacketContext, translationKey: string): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!originalInteraction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	await buttonInteraction?.editReply({
		embeds: [
			new CrowniclesSmallEventEmbed(
				"epicItemShop",
				StringUtils.getRandomTranslation(translationKey, originalInteraction.userLanguage),
				buttonInteraction.user,
				originalInteraction.userLanguage
			)
		]
	});
}
