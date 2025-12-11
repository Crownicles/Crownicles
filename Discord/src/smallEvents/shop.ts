import { ReactionCollectorShopSmallEventPacket } from "../../../Lib/src/packets/interaction/ReactionCollectorShopSmallEvent";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { StringUtils } from "../utils/StringUtils";
import { DiscordCollectorUtils } from "../utils/DiscordCollectorUtils";
import { RandomUtils } from "../../../Lib/src/utils/RandomUtils";
import { DisplayUtils } from "../utils/DisplayUtils";
import i18n from "../translations/i18n";
import { StringConstants } from "../../../Lib/src/constants/StringConstants";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";

/**
 * Send the initial embed for this small event
 * @param packet
 * @param context
 */
export async function smallShopCollector(context: PacketContext, packet: ReactionCollectorShopSmallEventPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction)!;
	const lng = interaction!.userLanguage;
	const data = packet.data.data;
	const gender = RandomUtils.crowniclesRandom.bool() ? StringConstants.SEX.MALE : StringConstants.SEX.FEMALE;
	const name = StringUtils.getRandomTranslation("smallEvents:shop.names", lng, { context: gender.short });

	const embed = new CrowniclesSmallEventEmbed(
		"shop",
		StringUtils.getRandomTranslation("smallEvents:shop.intro", lng, {
			context: gender.short,
			name
		})
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

export async function baseFunctionHandler(context: PacketContext, translationKey: string): Promise<void> {
	const originalInteraction = DiscordCache.getInteraction(context.discord!.interaction!);
	if (!originalInteraction) {
		return;
	}
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	await buttonInteraction?.editReply({
		embeds: [
			new CrowniclesSmallEventEmbed(
				"shop",
				StringUtils.getRandomTranslation(translationKey, originalInteraction.userLanguage),
				buttonInteraction.user,
				originalInteraction.userLanguage
			)
		]
	});
}
