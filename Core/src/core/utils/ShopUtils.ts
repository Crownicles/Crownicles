import {
	additionalShopData,
	BuyCallbackResult,
	CommandShopClosed,
	CommandShopGenericPurchase,
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

/**
 * Callback fired when a shop collector is closed by the player or expires
 * without any purchase. Lets callers chain another collector instead of
 * sending the default `CommandShopClosed` terminator (#4268).
 */
export type OnShopCloseCallback = (response: CrowniclesPacket[]) => Promise<void>;

export type ShopInformations = {
	shopCategories: ShopCategory[];
	player: Player;
	additionalShopData?: additionalShopData & { currency?: ShopCurrency };
	logger?: (keycloakId: string, shopItemName: ShopItemType, amount?: number, cityId?: string) => Promise<void>;
	cityId?: string;

	/*
	 * Optional hook invoked when the shop is closed by the player (close
	 * button) or expires without any purchase. When provided, the helper
	 * replaces the default `CommandShopClosed` packet so callers (e.g. the
	 * city shop flow) can re-open a parent collector — for instance to
	 * bring the player back to the main city menu instead of dismissing
	 * the UI entirely (#4268).
	 */
	onClose?: OnShopCloseCallback;
};

type ShopUtilsBuyCallbackResult = BuyCallbackResult & {
	postPurchase?: () => Promise<void>;
};

export abstract class ShopUtils {
	public static async createAndSendShopCollector(
		context: PacketContext,
		response: CrowniclesPacket[],
		{
			shopCategories,
			player,
			additionalShopData = {},
			logger,
			cityId,
			onClose
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
				if (onClose) {
					await onClose(response);
				}
				else {
					response.push(makePacket(CommandShopClosed, {}));
				}
				return;
			}
			const reactionInstance = reaction.reaction.data as ReactionCollectorShopItemReaction;
			if (!this.canBuyItem(interestingPlayerInfo, reactionInstance, collectorShop.currency, response)) {
				return;
			}
			const buyResult = await shopCategories
				.find(category => category.id === reactionInstance.shopCategoryId)!.items
				.find(item => item.id === reactionInstance.shopItemId)!.buyCallback(response, player.id, context, reactionInstance.amount);
			const isDetailedResult = typeof buyResult !== "boolean";
			const parsed: ShopUtilsBuyCallbackResult = isDetailedResult ? buyResult as ShopUtilsBuyCallbackResult : { success: buyResult as boolean };
			if (parsed.success) {
				// Get fresh PlayerMissionsInfo after buyCallback in case missions updated gem count
				const currentPlayerInfo = additionalShopData.currency === ShopCurrency.MONEY ? player : await PlayerMissionsInfos.getOfPlayer(player.id);
				await this.manageCurrencySpending(currentPlayerInfo, reactionInstance, response);
				await parsed.postPurchase?.();
				if (isDetailedResult) {
					const translationParams = this.getTranslationParams(reactionInstance.shopItemId, additionalShopData);
					response.push(makePacket(CommandShopGenericPurchase, {
						shopItemId: reactionInstance.shopItemId,
						amount: reactionInstance.amount,
						materials: parsed.materials,
						translationParams
					}));
				}
				logger?.(player.keycloakId, reactionInstance.shopItemId, reactionInstance.amount, cityId).then();
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

	private static canBuyItem(
		player: Player | PlayerMissionsInfo,
		reactionInstance: ReactionCollectorShopItemReaction,
		currency: ShopCurrency,
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

	private static async manageCurrencySpending(
		player: Player | PlayerMissionsInfo,
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

	private static getTranslationParams(shopItemId: ShopItemType, shopData: additionalShopData): Record<string, string> | undefined {
		if (shopItemId >= ShopItemType.WEEKLY_PLANT_TIER_1 && shopItemId <= ShopItemType.WEEKLY_PLANT_TIER_3) {
			const tierIndex = shopItemId - ShopItemType.WEEKLY_PLANT_TIER_1;
			const plantId = shopData.weeklyPlants?.[tierIndex];
			if (plantId) {
				return { plantId: String(plantId) };
			}
		}
		return undefined;
	}
}
