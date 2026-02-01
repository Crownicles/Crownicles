import {
	additionalShopData,
	CommandShopClosed,
	CommandShopNotEnoughCurrency,
	ReactionCollectorShop,
	ReactionCollectorShopCloseReaction,
	ReactionCollectorShopItemReaction,
	ShopCategory
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {
	CrowniclesPacket, makePacket, PacketContext
} from "../../../../Lib/src/packets/CrowniclesPacket";
import {
	EndCallback, ReactionCollectorInstance
} from "./ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "./BlockingUtils";
import Player from "../database/game/models/Player";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import { ShopCurrency } from "../../../../Lib/src/constants/ShopConstants";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";

export type ShopInformations = {
	shopCategories: ShopCategory[];
	player: Player;
	additionalShopData?: additionalShopData & { currency?: ShopCurrency };
	logger?: (keycloakId: string, shopItemName: ShopItemType, amount?: number) => Promise<void>;
};

export abstract class ShopUtils {
	public static async createAndSendShopCollector(
		context: PacketContext,
		response: CrowniclesPacket[],
		{
			shopCategories,
			player,
			additionalShopData = {},
			logger
		}: ShopInformations
	): Promise<void> {
		additionalShopData.currency ??= ShopCurrency.MONEY;
		const interestingPlayerInfo = additionalShopData.currency === ShopCurrency.MONEY ? player : await PlayerMissionsInfos.getOfPlayer(player.id);
		const availableCurrency = interestingPlayerInfo instanceof Player ? interestingPlayerInfo.money : interestingPlayerInfo.gems;
		const collectorShop = new ReactionCollectorShop(shopCategories, availableCurrency, additionalShopData);
		const endCallback: EndCallback = async (collector, response) => {
			const reaction = collector.getFirstReaction();

			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.SHOP);
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.SHOP_CONFIRMATION);
			if (!reaction || reaction.reaction.type === ReactionCollectorShopCloseReaction.name) {
				response.push(makePacket(CommandShopClosed, {}));
				return;
			}
			const reactionInstance = reaction.reaction.data as ReactionCollectorShopItemReaction;
			if (!this.canBuyItem(interestingPlayerInfo, reactionInstance, collectorShop.currency, response)) {
				return;
			}
			const buyResult = await shopCategories
				.find(category => category.id === reactionInstance.shopCategoryId)!.items
				.find(item => item.id === reactionInstance.shopItemId)!.buyCallback(response, player.id, context, reactionInstance.amount);
			if (buyResult) {
				// Get fresh PlayerMissionsInfo after buyCallback in case missions updated gem count
				const currentPlayerInfo = additionalShopData.currency === ShopCurrency.MONEY ? player : await PlayerMissionsInfos.getOfPlayer(player.id);
				await this.manageCurrencySpending(currentPlayerInfo, reactionInstance, response);
				logger?.(player.keycloakId, reactionInstance.shopItemId, reactionInstance.amount).then();
			}
		};

		const packet = new ReactionCollectorInstance(
			collectorShop,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId]
			},
			endCallback
		)
			.block(player.keycloakId, BlockingConstants.REASONS.SHOP)
			.build();

		response.push(packet);
	}

	private static canBuyItem<T extends ShopCurrency>(
		player: T extends ShopCurrency.MONEY ? Player : PlayerMissionsInfo,
		reactionInstance: ReactionCollectorShopItemReaction,
		currency: T,
		response: CrowniclesPacket[]
	): boolean {
		const valueToCheck = player instanceof Player ? player.money : player.gems;
		if (valueToCheck < reactionInstance.price) {
			response.push(makePacket(CommandShopNotEnoughCurrency, {
				missingCurrency: reactionInstance.price - valueToCheck,
				currency
			}));
			return false;
		}
		return true;
	}

	private static async manageCurrencySpending<T extends ShopCurrency>(
		player: T extends ShopCurrency.MONEY ? Player : PlayerMissionsInfo,
		reactionInstance: ReactionCollectorShopItemReaction,
		response: CrowniclesPacket[]
	): Promise<void> {
		if (player instanceof Player) {
			await player.spendMoney({
				amount: reactionInstance.price,
				reason: NumberChangeReason.SHOP,
				response
			});
		}
		else {
			await player.spendGems(reactionInstance.price, response, NumberChangeReason.MISSION_SHOP);
		}
		await player.save();
	}
}
