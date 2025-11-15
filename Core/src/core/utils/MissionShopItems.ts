import { ShopItem } from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import { Players } from "../database/game/models/Player";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import { Constants } from "../../../../Lib/src/constants/Constants";
import { MissionsController } from "../missions/MissionsController";
import {
	generateRandomItem, giveItemToPlayer
} from "./ItemUtils";
import { ItemRarity } from "../../../../Lib/src/constants/ItemConstants";
import { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import {
	CommandMissionShopAlreadyBoughtPointsThisWeek,
	CommandMissionShopKingsFavor,
	CommandMissionShopMoney
} from "../../../../Lib/src/packets/commands/CommandMissionShopPacket";
import { getDayNumber } from "../../../../Lib/src/utils/TimeUtils";

export function calculateGemsToMoneyRatio(): number {
	const frac = function(x: number): number {
		return x >= 0 ? x % 1 : 1 + x % 1;
	};
	return Constants.MISSION_SHOP.BASE_RATIO
		+ Math.round(Constants.MISSION_SHOP.RANGE_MISSION_MONEY * 2
			* frac(100 * Math.sin(Constants.MISSION_SHOP.SIN_RANDOMIZER * (getDayNumber() % Constants.MISSION_SHOP.SEED_RANGE) + 1))
			- Constants.MISSION_SHOP.RANGE_MISSION_MONEY);
}

export function getMoneyShopItem(): ShopItem {
	return {
		id: ShopItemType.MONEY,
		price: Constants.MISSION_SHOP.PRICES.MONEY,
		amounts: [1],
		buyCallback: async (response: CrowniclesPacket[], playerId: number): Promise<boolean> => {
			const player = await Players.getById(playerId);
			const amount = calculateGemsToMoneyRatio();
			await player.addMoney({
				amount,
				response,
				reason: NumberChangeReason.MISSION_SHOP
			});
			await player.save();
			if (amount < Constants.MISSION_SHOP.KINGS_MONEY_VALUE_THRESHOLD_MISSION) {
				await MissionsController.update(player, response, { missionId: "kingsMoneyValue" });
			}
			response.push(makePacket(CommandMissionShopMoney, {
				amount
			}));
			return true;
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
			const missionsInfo = await PlayerMissionsInfos.getOfPlayer(player.id);
			if (missionsInfo.hasBoughtPointsThisWeek) {
				response.push(makePacket(CommandMissionShopAlreadyBoughtPointsThisWeek, {}));
				return false;
			}
			await player.addScore({
				amount: Constants.MISSION_SHOP.THOUSAND_POINTS,
				response,
				reason: NumberChangeReason.MISSION_SHOP
			});
			missionsInfo.hasBoughtPointsThisWeek = true;
			response.push(makePacket(CommandMissionShopKingsFavor, {}));
			await Promise.all([player.save(), missionsInfo.save()]);
			return true;
		}
	};
}
