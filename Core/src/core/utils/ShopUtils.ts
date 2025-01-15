import {
	AdditionnalShopData,
	CommandShopClosed,
	CommandShopNotEnoughCurrency,
	ReactionCollectorShop,
	ReactionCollectorShopCloseReaction,
	ReactionCollectorShopItemReaction,
	ShopCategory
} from "../../../../Lib/src/packets/interaction/ReactionCollectorShop";
import {DraftBotPacket, makePacket, PacketContext} from "../../../../Lib/src/packets/DraftBotPacket";
import {EndCallback, ReactionCollectorInstance} from "./ReactionsCollector";
import {BlockingConstants} from "../../../../Lib/src/constants/BlockingConstants";
import {BlockingUtils} from "./BlockingUtils";
import Player, {Players} from "../database/game/models/Player";
import {NumberChangeReason, ShopItemType, ShopItemTypeToString} from "../../../../Lib/src/constants/LogsConstants";
import {ShopCurrency} from "../../../../Lib/src/constants/ShopConstants";
import PlayerMissionsInfo, {PlayerMissionsInfos} from "../database/game/models/PlayerMissionsInfo";
import {MissionsController} from "../missions/MissionsController";

export type ShopInformations = {
	shopCategories: ShopCategory[],
	player: Player,
	additionnalShopData?: AdditionnalShopData & { currency?: ShopCurrency }
	logger: (keycloakId: string, shopItemName: ShopItemType, amount?: number) => Promise<void>
}

export class ShopUtils {

	public static shopItemTypeToId(shopItemType: ShopItemType): string {
		return ShopItemTypeToString[shopItemType];
	}

	public static shopItemTypeFromId(id: string): ShopItemType {
		return Object.values(ShopItemType).find((key: ShopItemType) => ShopItemTypeToString[key] === id) as ShopItemType;
	}

	public static async createAndSendShopCollector(
		context: PacketContext,
		response: DraftBotPacket[],
		{
			shopCategories,
			player,
			additionnalShopData = {},
			logger
		}: ShopInformations
	): Promise<void> {
		additionnalShopData.currency ??= ShopCurrency.MONEY;
		const interestingPlayerInfo = additionnalShopData.currency === ShopCurrency.MONEY ? player : await PlayerMissionsInfos.getOfPlayer(player.id);
		const availableCurrency = interestingPlayerInfo instanceof Player ? interestingPlayerInfo.money : interestingPlayerInfo.gems;
		const collectorShop = new ReactionCollectorShop(shopCategories, availableCurrency, additionnalShopData);
		const endCallback: EndCallback = async (collector, response) => {
			const reaction = collector.getFirstReaction();

			BlockingUtils.unblockPlayer(player.id, BlockingConstants.REASONS.SHOP);
			if (!reaction || reaction.reaction.type === ReactionCollectorShopCloseReaction.name) {
				response.push(makePacket(CommandShopClosed, {}));
				return;
			}
			const reactionInstance = reaction.reaction.data as ReactionCollectorShopItemReaction;
			if (!this.canBuyItem(interestingPlayerInfo, reactionInstance, collectorShop.currency, response)) {
				return;
			}
			const buyResult = await shopCategories
				.find(category => category.id === reactionInstance.shopCategoryId).items
				.find(item => item.id === reactionInstance.shopItemId).buyCallback(response, player.id, context, reactionInstance.amount);
			if (buyResult) {
				await this.manageCurrencySpending(interestingPlayerInfo, reactionInstance, response);
				logger(player.keycloakId, reactionInstance.shopItemId, reactionInstance.amount).then();
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
			.block(player.id, BlockingConstants.REASONS.SHOP)
			.build();

		response.push(packet);
	}

	private static canBuyItem<T extends ShopCurrency>(
		player: T extends ShopCurrency.MONEY ? Player : PlayerMissionsInfo,
		reactionInstance: ReactionCollectorShopItemReaction,
		currency: T,
		response: DraftBotPacket[]
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
		response: DraftBotPacket[]
	): Promise<void> {
		if (player instanceof Player) {
			await player.spendMoney({
				amount: reactionInstance.price,
				reason: NumberChangeReason.SHOP,
				response
			});
		}
		else {
			player.gems -= reactionInstance.price;
			await MissionsController.update(await Players.getById(player.playerId), response, {missionId: "spendGems"});
		}
		await player.save();
	}
}