import { ShopItem } from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	Player, Players
} from "../database/game/models/Player";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { MissionsController } from "../missions/MissionsController";
import {
	generateRandomItem, giveItemToPlayer
} from "./ItemUtils";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import {
	PlayerMissionsInfo, PlayerMissionsInfos
} from "../database/game/models/PlayerMissionsInfo";
import {
	CommandMissionShopAlreadyBoughtPointsThisWeek,
	CommandMissionShopKingsFavor,
	CommandMissionShopMoney
} from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import { getDayNumber } from "../../../../Lib/src/utils/TimeUtils";
import { frac } from "../../../../Lib/src/utils/MathUtils";
import { withLockedEntitiesSafe } from "./withLockedEntitiesSafe";

export function calculateGemsToMoneyRatio(dayOffset = 0): number {
	return Constants.MISSION_SHOP.BASE_RATIO
		+ Math.round(Constants.MISSION_SHOP.RANGE_MISSION_MONEY * 2
			* frac(100 * Math.sin(Constants.MISSION_SHOP.SIN_RANDOMIZER * ((getDayNumber() + dayOffset) % Constants.MISSION_SHOP.SEED_RANGE) + 1))
			- Constants.MISSION_SHOP.RANGE_MISSION_MONEY);
}

export function getMoneyShopItem(): ShopItem {
	return {
		id: ShopItemType.MONEY,
		price: Constants.MISSION_SHOP.PRICES.MONEY,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => {
			const amount = calculateGemsToMoneyRatio();

			/*
			 * Lock the player so `addMoney` + `save` are atomic against
			 * concurrent gem-shop money buys on the same account (#3760).
			 */
			let credited = false;
			await withLockedEntitiesSafe(
				[Player.lockKey(playerId)] as const,
				`getMoneyShopItem(player=${playerId})`,
				async ([lockedPlayer]) => {
					await lockedPlayer.addMoney({
						amount,
						response,
						reason: NumberChangeReason.MISSION_SHOP
					});
					await lockedPlayer.save();
					if (amount < Constants.MISSION_SHOP.KINGS_MONEY_VALUE_THRESHOLD_MISSION) {
						await MissionsController.update(lockedPlayer, response, { missionId: "kingsMoneyValue" });
					}
					credited = true;
				}
			);

			if (credited) {
				response.push(makePacket(CommandMissionShopMoney, {
					amount
				}));
			}
			return credited;
		}
	};
}

export function getValuableItemShopItem(): ShopItem {
	return {
		id: ShopItemType.TREASURE,
		price: Constants.MISSION_SHOP.PRICES.VALUABLE_ITEM,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number, context: PacketContext): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const item = generateRandomItem({
				minRarity: ItemRarity.SPECIAL
			});
			await giveItemToPlayer(response, context, player, item);
			return true;
		}
	};
}

export function getAThousandPointsShopItem(): ShopItem {
	return {
		id: ShopItemType.KINGS_FAVOR,
		price: Constants.MISSION_SHOP.PRICES.THOUSAND_POINTS,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => {
			const player = await Players.getById(playerId);

			// Pre-warm the PlayerMissionsInfo row so the lock can pin it
			await PlayerMissionsInfos.getOfPlayer(player.id);

			/*
			 * Lock both rows together so the `hasBoughtPointsThisWeek` check
			 * and the score award + flag flip happen atomically. Without this
			 * lock two concurrent purchases could both pass the check, double
			 * the score award, while only paying the gem cost once after the
			 * fact in ShopUtils.manageCurrencySpending (#3760).
			 */
			let success = false;
			const ranToCompletion = await withLockedEntitiesSafe(
				[
					Player.lockKey(player.id),
					PlayerMissionsInfo.lockKey(player.id)
				] as const,
				`getAThousandPointsShopItem(player=${player.id})`,
				async ([lockedPlayer, lockedMissionsInfo]) => {
					if (lockedMissionsInfo.hasBoughtPointsThisWeek) {
						response.push(makePacket(CommandMissionShopAlreadyBoughtPointsThisWeek, {}));
						return;
					}
					await lockedPlayer.addScore({
						amount: Constants.MISSION_SHOP.THOUSAND_POINTS,
						response,
						reason: NumberChangeReason.MISSION_SHOP
					});
					lockedMissionsInfo.hasBoughtPointsThisWeek = true;
					response.push(makePacket(CommandMissionShopKingsFavor, { amount: Constants.MISSION_SHOP.THOUSAND_POINTS }));
					await Promise.all([lockedPlayer.save(), lockedMissionsInfo.save()]);
					success = true;
				}
			);
			return ranToCompletion && success;
		}
	};
}
