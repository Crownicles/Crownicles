import {
	CommandShopAlreadyHaveBadge,
	CommandShopBadgeBought,
	ShopItem
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import { ShopConstants } from "../../../../Lib/src/constants/ShopConstants";
import { ShopItemType } from "../../../../Lib/src/constants/LogsConstants";
import { makePacket } from "../../../../Lib/src/packets/CrowniclesPacket";
import { Badge } from "../../../../Lib/src/types/Badge";
import { PlayerBadgesManager } from "../database/game/models/PlayerBadges";

/**
 * Get the shop item for the money mouth badge
 */
export function getBadgeShopItem(): ShopItem {
	return {
		id: ShopItemType.MONEY_MOUTH_BADGE,
		price: ShopConstants.MONEY_MOUTH_BADGE_PRICE,
		amounts: [1],
		buyCallback: async (response, playerId): Promise<boolean> => {
			const hasBadge = await PlayerBadgesManager.hasBadge(playerId, Badge.RICH);
			if (hasBadge) {
				response.push(makePacket(CommandShopAlreadyHaveBadge, {}));
				return false;
			}
			await PlayerBadgesManager.addBadge(playerId, Badge.RICH);
			response.push(makePacket(CommandShopBadgeBought, {}));
			return true;
		}
	};
}
