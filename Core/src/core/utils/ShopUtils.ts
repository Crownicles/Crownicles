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
	EndCallback, ReactionCollectorController, ReactionCollectorInstance
} from "./ReactionsCollector";
import { BlockingConstants } from "../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "./BlockingUtils";
import Player from "../database/game/models/Player";
import {
	NumberChangeReason, ShopItemType
} from "../../../../Lib/src/constants/LogsConstants";
import { ShopCurrency } from "../../../../Lib/src/constants/ShopConstants";
import PlayerMissionsInfo, { PlayerMissionsInfos } from "../database/game/models/PlayerMissionsInfo";
import {
	InventoryInfo, InventoryInfos
} from "../database/game/models/InventoryInfo";
import { PetEntity } from "../database/game/models/PetEntity";
import {
	LockKey, Locked
} from "../../../../Lib/src/locks/withLockedEntities";
import { withLockedPlayerAndMissions } from "./withLockedPlayerAndMissions";

type ShopPurchase = {
	shop: ShopInformations;
	reaction: ReactionCollectorShopItemReaction;
};

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
	shopId?: string;

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
		shop: ShopInformations
	): Promise<void> {
		const {
			shopCategories, player, shopId
		} = shop;
		const additionalShopData = shop.additionalShopData ?? {};
		additionalShopData.currency ??= ShopCurrency.MONEY;
		const interestingPlayerInfo = await this.getCurrencyHolder(player, additionalShopData.currency);
		const availableCurrency = interestingPlayerInfo instanceof Player ? interestingPlayerInfo.money : interestingPlayerInfo.gems;
		const collectorShop = new ReactionCollectorShop(shopCategories, availableCurrency, additionalShopData, shopId);
		const endCallback: EndCallback = (collector, response): Promise<void> => this.handleShopReaction(context, response, {
			...shop, additionalShopData
		}, collector);

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

	private static async handleShopReaction(context: PacketContext, response: CrowniclesPacket[], shop: ShopInformations, collector: ReactionCollectorInstance): Promise<void> {
		const {
			player, onClose
		} = shop;
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
		await this.processPurchase(context, response, {
			shop,
			reaction: reaction.reaction.data as ReactionCollectorShopItemReaction
		});
	}

	private static async processPurchase(context: PacketContext, response: CrowniclesPacket[], purchase: ShopPurchase): Promise<void> {
		const {
			shop, reaction
		} = purchase;
		const {
			player, logger, cityId
		} = shop;
		const locks = await this.getAdditionalPurchaseLocks(player, reaction.shopItemId);
		let purchased = false;
		const purchaseResponse: CrowniclesPacket[] = [];
		try {
			purchased = await withLockedPlayerAndMissions(player.id, async lockedPlayer => {
				if (reaction.shopItemId === ShopItemType.LOVE_POINTS_VALUE && lockedPlayer.petId !== player.petId) {
					purchaseResponse.push(makePacket(CommandShopClosed, {}));
					return false;
				}
				return await this.buyItemUnderLock(context, purchaseResponse, lockedPlayer, purchase);
			}, locks);
		}
		catch (error) {
			ReactionCollectorController.discardUnpublishedCollectors(purchaseResponse);
			throw error;
		}
		response.push(...purchaseResponse);
		if (purchased) {
			logger?.(player.keycloakId, reaction.shopItemId, reaction.amount, cityId).then();
		}
	}

	private static async getCurrencyHolder(player: Player, currency: ShopCurrency): Promise<Player | PlayerMissionsInfo> {
		if (currency === ShopCurrency.MONEY) {
			return player;
		}
		return await PlayerMissionsInfos.getOfPlayer(player.id);
	}

	private static async getAdditionalPurchaseLocks(player: Player, itemType: ShopItemType): Promise<LockKey[]> {
		if (itemType === ShopItemType.PLANT_SLOT_EXTENSION) {
			await InventoryInfos.getOfPlayer(player.id);
			return [InventoryInfo.lockKey(player.id)];
		}
		if (itemType === ShopItemType.LOVE_POINTS_VALUE && player.petId !== null) {
			return [PetEntity.lockKey(player.petId)];
		}
		return [];
	}

	private static async buyItemUnderLock(context: PacketContext, response: CrowniclesPacket[], player: Locked<Player>, purchase: ShopPurchase): Promise<boolean> {
		const {
			shop, reaction
		} = purchase;
		const data = shop.additionalShopData ?? {};
		const currency = data.currency ?? ShopCurrency.MONEY;
		const payer = await this.getCurrencyHolder(player, currency);
		if (!this.canBuyItem(payer, reaction, currency, response)) {
			return false;
		}
		const item = shop.shopCategories.find(category => category.id === reaction.shopCategoryId)!.items.find(candidate => candidate.id === reaction.shopItemId)!;
		const buyResult = await item.buyCallback(response, player.id, context, reaction.amount);
		const isDetailedResult = typeof buyResult !== "boolean";
		const parsed: ShopUtilsBuyCallbackResult = isDetailedResult ? buyResult : { success: buyResult };
		if (!parsed.success) {
			return false;
		}
		await player.reload();
		const currentPayer = await this.getCurrencyHolder(player, currency);
		await this.manageCurrencySpendingUnderLock(currentPayer, reaction, response);
		await parsed.postPurchase?.();
		if (isDetailedResult) {
			response.push(makePacket(CommandShopGenericPurchase, {
				shopItemId: reaction.shopItemId,
				amount: reaction.amount,
				materials: parsed.materials,
				translationParams: this.getTranslationParams(reaction.shopItemId, data)
			}));
		}
		return true;
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

	private static async manageCurrencySpendingUnderLock(
		player: Locked<Player> | Locked<PlayerMissionsInfo>,
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
