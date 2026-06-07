import { packetHandler } from "../../PacketHandler";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	SmallEventRecipeShopAcceptedPacket,
	SmallEventRecipeShopCannotBuyPacket,
	SmallEventRecipeShopRefusedPacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventRecipeShopPacket";
import {
	buildRecipePurchasedMessage, recipeShopOutcomeHandler
} from "../../../smallEvents/recipeShop";
import i18n from "../../../translations/i18n";

export default class RecipeShopSmallEventHandler {
	@packetHandler(SmallEventRecipeShopAcceptedPacket)
	async recipeShopAccepted(context: PacketContext, packet: SmallEventRecipeShopAcceptedPacket): Promise<void> {
		await recipeShopOutcomeHandler(
			context,
			packet.source,
			buildRecipePurchasedMessage(packet.recipeId, packet.recipeCost, context.discord!.language)
		);
	}

	@packetHandler(SmallEventRecipeShopRefusedPacket)
	async recipeShopRefused(context: PacketContext, packet: SmallEventRecipeShopRefusedPacket): Promise<void> {
		await recipeShopOutcomeHandler(
			context,
			packet.source,
			i18n.t("smallEvents:recipeShop.refused", { lng: context.discord!.language })
		);
	}

	@packetHandler(SmallEventRecipeShopCannotBuyPacket)
	async recipeShopCannotBuy(context: PacketContext, packet: SmallEventRecipeShopCannotBuyPacket): Promise<void> {
		await recipeShopOutcomeHandler(
			context,
			packet.source,
			i18n.t("smallEvents:recipeShop.notEnoughMoney", { lng: context.discord!.language })
		);
	}
}
