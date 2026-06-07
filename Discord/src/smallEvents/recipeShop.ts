import {
	ReactionCollectorRecipeShopSmallEventData,
	ReactionCollectorRecipeShopSmallEventPacket,
	RecipeShopSource
} from "../../../Lib/src/packets/interaction/ReactionCollectorRecipeShopSmallEvent";
import { PacketContext } from "../../../Lib/src/packets/CrowniclesPacket";
import { DiscordCache } from "../bot/DiscordCache";
import { CrowniclesSmallEventEmbed } from "../messages/CrowniclesSmallEventEmbed";
import { CrowniclesIcons } from "../../../Lib/src/CrowniclesIcons";
import i18n from "../translations/i18n";
import { Language } from "../../../Lib/src/Language";
import { ReactionCollectorReturnTypeOrNull } from "../packetHandlers/handlers/ReactionCollectorHandlers";
import { DiscordCollectorUtils } from "../utils/DiscordCollectorUtils";
import { buildRecipeDiscoveryMessage } from "../utils/SmallEventUtils";
import { buildFarmerDescription } from "../packetHandlers/handlers/smallEvents/farmer";
import { buildUltimateFoodMerchantDescription } from "../packetHandlers/handlers/smallEvents/ultimateFoodMerchant";

/**
 * Maps each recipe shop source to the small event icon used for its embeds
 */
const RECIPE_SHOP_SOURCE_ICON: Record<RecipeShopSource, keyof typeof CrowniclesIcons.smallEvents> = {
	[RecipeShopSource.FARMER]: "farmer",
	[RecipeShopSource.GASPARD_JO]: "ultimateFoodMerchant"
};

/**
 * Build the base event description (without the recipe offer) for a recipe shop offer
 */
function buildBaseDescription(data: ReactionCollectorRecipeShopSmallEventData, lng: Language): string {
	if (data.source === RecipeShopSource.FARMER && data.farmer) {
		return buildFarmerDescription(data.farmer.interactionName, data.farmer.amount, lng);
	}
	if (data.source === RecipeShopSource.GASPARD_JO && data.ultimateFoodMerchant) {
		return buildUltimateFoodMerchantDescription(data.ultimateFoodMerchant.interactionName, data.ultimateFoodMerchant.amount, lng);
	}
	return "";
}

/**
 * Build the full description shown on the recipe purchase offer (base outcome + offer line)
 */
function buildOfferDescription(data: ReactionCollectorRecipeShopSmallEventData, lng: Language): string {
	const offerLine = i18n.t(`smallEvents:recipeShop.offer.${data.source}`, {
		lng,
		recipe: i18n.t(`models:cooking.recipes.${data.recipeId}`, { lng }),
		price: data.recipeCost
	});
	return `${buildBaseDescription(data, lng)}\n\n${offerLine}`;
}

/**
 * Display the recipe purchase offer collector
 */
export async function recipeShopCollector(context: PacketContext, packet: ReactionCollectorRecipeShopSmallEventPacket): Promise<ReactionCollectorReturnTypeOrNull> {
	const interaction = DiscordCache.getInteraction(context.discord!.interaction);
	if (!interaction) {
		return null;
	}
	const lng = interaction.userLanguage;
	const data = packet.data.data;

	const embed = new CrowniclesSmallEventEmbed(
		RECIPE_SHOP_SOURCE_ICON[data.source],
		buildOfferDescription(data, lng),
		interaction.user,
		lng
	);
	return await DiscordCollectorUtils.createAcceptRefuseCollector(interaction, embed, packet, context);
}

/**
 * Edit the offer message to show the outcome of the recipe purchase decision
 */
export async function recipeShopOutcomeHandler(context: PacketContext, source: RecipeShopSource, description: string): Promise<void> {
	const buttonInteraction = DiscordCache.getButtonInteraction(context.discord!.buttonInteraction!);
	if (!buttonInteraction) {
		return;
	}
	const lng = context.discord!.language;
	await buttonInteraction.editReply({
		embeds: [
			new CrowniclesSmallEventEmbed(
				RECIPE_SHOP_SOURCE_ICON[source],
				description,
				buttonInteraction.user,
				lng
			)
		],
		components: []
	});
}

/**
 * Build the "recipe purchased" outcome message
 */
export function buildRecipePurchasedMessage(recipeId: string, recipeCost: number, lng: Language): string {
	return buildRecipeDiscoveryMessage(recipeId, lng, recipeCost);
}
