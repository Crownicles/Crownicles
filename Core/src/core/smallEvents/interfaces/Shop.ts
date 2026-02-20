import { GenericItem } from "../../../data/GenericItem";
import Player from "../../database/game/models/Player";
import { Maps } from "../../maps/Maps";
import { ExecuteSmallEventLike } from "../../../data/SmallEvent";
import {
	getItemValue, giveItemToPlayer, toItemWithDetails
} from "../../utils/ItemUtils";
import {
	EndCallback, ReactionCollectorInstance
} from "../../utils/ReactionsCollector";
import { BlockingConstants } from "../../../../../Lib/src/constants/BlockingConstants";
import { BlockingUtils } from "../../utils/BlockingUtils";
import {
	SmallEventAnyShopAcceptedPacket,
	SmallEventAnyShopCannotBuyPacket,
	SmallEventAnyShopRefusedPacket
} from "../../../../../Lib/src/packets/smallEvents/SmallEventAnyShopPacket";
import { SmallEventConstants } from "../../../../../Lib/src/constants/SmallEventConstants";
import { NumberChangeReason } from "../../../../../Lib/src/constants/LogsConstants";
import { CrowniclesPacket } from "../../../../../Lib/src/packets/CrowniclesPacket";
import {
	ReactionCollector,
	ReactionCollectorAcceptReaction
} from "../../../../../Lib/src/packets/interaction/ReactionCollectorPacket";
import { ReactionCollectorAnyShopSmallEventData } from "../../../../../Lib/src/packets/interaction/ReactionCollectorAnyShopSmallEvent";

export type ShopSmallEventItem = {
	item: GenericItem;
	price: number;
	multiplier: number;
};

export abstract class Shop<
	Accept extends SmallEventAnyShopAcceptedPacket,
	Refuse extends SmallEventAnyShopRefusedPacket,
	CannotBuy extends SmallEventAnyShopCannotBuyPacket,
	Collector extends ReactionCollector
> {
	canBeExecuted = Maps.isOnContinent;

	abstract getRandomItem(): GenericItem | Promise<GenericItem>;

	abstract getPriceMultiplier(player: Player): number | Promise<number>;

	abstract getAcceptPacket(): Accept;

	abstract getRefusePacket(): Refuse;

	abstract getCannotBuyPacket(): CannotBuy;

	abstract getPopulatedReactionCollector(basePacket: ReactionCollectorAnyShopSmallEventData, shopItem: ShopSmallEventItem): Collector;

	/**
	 * Called after a successful purchase. Override this method to add custom logic after buying an item.
	 * @param _player
	 * @param _shopItem
	 * @param _response
	 */
	async afterPurchase(_player: Player, _shopItem: ShopSmallEventItem, _response: CrowniclesPacket[]): Promise<void> {
		// Default implementation does nothing
	}

	public executeSmallEvent: ExecuteSmallEventLike = async (response, player, context) => {
		const itemMultiplier = await this.getPriceMultiplier(player);
		const randomItem = await this.getRandomItem();
		const itemPrice = Math.round(getItemValue(randomItem) * itemMultiplier);
		const shopItem = {
			item: randomItem,
			price: itemPrice,
			multiplier: itemMultiplier
		};

		const collector = this.getPopulatedReactionCollector({
			item: toItemWithDetails(player, randomItem, 0, null),
			price: itemPrice
		}, shopItem);

		const packet = new ReactionCollectorInstance(
			collector,
			context,
			{
				allowedPlayerKeycloakIds: [player.keycloakId]
			},
			this.callbackShopSmallEvent(player, shopItem)
		)
			.block(player.keycloakId, BlockingConstants.REASONS.MERCHANT)
			.build();

		response.push(packet);
	};

	private callbackShopSmallEvent(player: Player, shopItem: ShopSmallEventItem): EndCallback {
		return async (collector: ReactionCollectorInstance, response: CrowniclesPacket[]) => {
			BlockingUtils.unblockPlayer(player.keycloakId, BlockingConstants.REASONS.MERCHANT);
			const reaction = collector.getFirstReaction();
			const isValidated = reaction && reaction.reaction.type === ReactionCollectorAcceptReaction.name;
			const canBuy = player.money >= shopItem.price;
			response.push(!isValidated ? this.getRefusePacket() : !canBuy ? this.getCannotBuyPacket() : this.getAcceptPacket());
			if (!isValidated || !canBuy) {
				return;
			}
			await giveItemToPlayer(response, collector.context, player, shopItem.item, { resaleMultiplier: SmallEventConstants.SHOP.RESALE_MULTIPLIER });
			await player.spendMoney({
				amount: shopItem.price,
				response,
				reason: NumberChangeReason.SMALL_EVENT
			});
			await player.save();
			await this.afterPurchase(player, shopItem, response);
		};
	}
}
