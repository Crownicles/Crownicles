import {
	CrowniclesPacket, PacketContext, makePacket
} from "../../../../Lib/src/packets/CrowniclesPacket";
import Player from "../database/game/models/Player";
import {
	EndCallback, ReactionCollectorInstance
} from "../utils/ReactionsCollector";
import { BlockingUtils } from "../utils/BlockingUtils";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { ReactionCollectorAcceptReaction } from "../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import {
	ReactionCollectorRecipeShopSmallEvent,
	RecipeShopFarmerContext,
	RecipeShopUltimateFoodMerchantContext,
	RecipeShopSource
} from "../../../../Lib/src/packets/interaction/ReactionCollectorRecipeShopSmallEvent";
import {
	SmallEventRecipeShopAcceptedPacket,
	SmallEventRecipeShopCannotBuyPacket,
	SmallEventRecipeShopRefusedPacket
} from "../../../../Lib/src/packets/smallEvents/SmallEventRecipeShopPacket";
import {
	RecipeDiscoveryOffer, RecipeDiscoveryService
} from "../cooking/RecipeDiscoveryService";
import { withLockedPlayerSafe } from "../utils/withLockedPlayerSafe";

/**
 * Build the end callback handling the player's decision on the recipe purchase offer.
 */
function getRecipeShopEndCallback(player: Player, source: RecipeShopSource, offer: RecipeDiscoveryOffer): EndCallback {
	return async (collector, response) => {
		BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.MERCHANT);
		await withLockedPlayerSafe(player, "recipeShop endCallback", async lockedPlayer => {
			const reaction = collector.getFirstReaction();
			const accepted = reaction?.reaction.type === ReactionCollectorAcceptReaction.name;
			if (!accepted) {
				response.push(makePacket(SmallEventRecipeShopRefusedPacket, { source }));
				return;
			}
			const bought = await RecipeDiscoveryService.discoverAndPay({
				player: lockedPlayer,
				recipeId: offer.recipe.id,
				cost: offer.cost,
				response
			});
			if (!bought) {
				response.push(makePacket(SmallEventRecipeShopCannotBuyPacket, { source }));
				return;
			}
			response.push(makePacket(SmallEventRecipeShopAcceptedPacket, {
				source,
				recipeId: offer.recipe.id,
				recipeCost: offer.cost
			}));
		});
	};
}

/**
 * Open an accept/refuse collector letting the player choose whether to buy a discovered recipe.
 * The base event outcome (carried by the farmer/ultimate food merchant context) is rendered together with the offer.
 */
export function openRecipeShopOffer(params: {
	response: CrowniclesPacket[];
	player: Player;
	context: PacketContext;
	source: RecipeShopSource;
	offer: RecipeDiscoveryOffer;
	farmer?: RecipeShopFarmerContext;
	ultimateFoodMerchant?: RecipeShopUltimateFoodMerchantContext;
}): void {
	const collector = new ReactionCollectorRecipeShopSmallEvent({
		source: params.source,
		recipeId: params.offer.recipe.id,
		recipeCost: params.offer.cost,
		...params.farmer ? { farmer: params.farmer } : {},
		...params.ultimateFoodMerchant ? { ultimateFoodMerchant: params.ultimateFoodMerchant } : {}
	});

	const packet = new ReactionCollectorInstance(
		collector,
		params.context,
		{
			allowedPlayerKeycloakIds: [params.player.keycloakId]
		},
		getRecipeShopEndCallback(params.player, params.source, params.offer)
	)
		.block(params.player.keycloakId, BlockingConstants.REASONS.MERCHANT)
		.build();

	params.response.push(packet);
}
