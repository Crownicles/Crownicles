import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import {
	CrowniclesPacket, PacketContext, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { ItemWithDetails } from "../../types/ItemWithDetails";
import { ShopCurrency } from "../../constants/ShopConstants";
import {
	ShopItemType
} from "../../constants/LogsConstants";
import { PlantId } from "../../constants/PlantConstants";

/**
 * Map of materialId (as string) to quantity received
 */
export type MaterialDistribution = Record<string, number>;

export type BuyCallbackResult = {
	success: boolean;
	materials?: MaterialDistribution;

	/**
	 * Bought plants that went straight to the home plant storage (plant inventory linked to the home)
	 */
	plantsSentToHomeStorage?: number;
};

export interface ShopItem {
	id: ShopItemType;

	price: number;

	amounts: readonly number[];

	buyCallback: (response: CrowniclesPacket[], player: number, context: PacketContext, amount: number) => boolean | BuyCallbackResult | Promise<boolean | BuyCallbackResult>;
}

export interface ShopCategory {
	id: string;

	items: ShopItem[];
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandShopClosed extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandShopNoAlterationToHeal extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandShopHealAlterationDone extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandShopAlreadyHaveBadge extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandShopBadgeBought extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandShopBoughtTooMuchDailyPotions extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandShopNoPlantSlotAvailable extends CrowniclesPacket {
	/**
	 * Set when the plant inventory is linked to the home plant storage: neither the chest nor the plant slots had room
	 */
	linkedToHomeStorage?: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandShopNoGardenForRemoteHarvestTalisman extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandShopNotEnoughCurrency extends CrowniclesPacket {
	missingCurrency!: number;

	currency!: ShopCurrency;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandShopGenericPurchase extends CrowniclesPacket {
	shopItemId!: ShopItemType;

	amount!: number;

	materials?: MaterialDistribution;

	plantsSentToHomeStorage?: number;

	translationParams?: Record<string, string>;
}

export class ReactionCollectorShopData extends ReactionCollectorData {
	availableCurrency!: number;

	currency!: ShopCurrency;

	additionalShopData!: additionalShopData;
}

export class ReactionCollectorShopItemReaction extends ReactionCollectorReaction {
	shopCategoryId!: string;

	shopItemId!: ShopItemType;

	price!: number;

	amount!: number;
}

export class ReactionCollectorShopCloseReaction extends ReactionCollectorReaction {

}

export type additionalShopData = {
	remainingPotions?: number;
	dailyPotion?: ItemWithDetails;
	gemToMoneyRatio?: number;
	remainingTokens?: number;
	weeklyPlants?: PlantId[];
};

type ShopReaction = ReactionCollectorShopItemReaction | ReactionCollectorShopCloseReaction;
export type ReactionCollectorShopPacket = ReactionCollectorCreationPacket<
	ReactionCollectorShopData,
	ShopReaction
>;

export class ReactionCollectorShop extends ReactionCollector {
	public readonly currency!: ShopCurrency.MONEY | ShopCurrency.GEM;

	private readonly shopCategories!: ShopCategory[];

	private readonly availableCurrency!: number;

	private readonly additionalShopData!: additionalShopData;

	constructor(
		shopCategories: ShopCategory[],
		availableCurrency: number,
		additionalShopData: additionalShopData & {
			currency?: ShopCurrency;
		} = {}
	) {
		super();
		this.shopCategories = shopCategories;
		this.availableCurrency = availableCurrency;
		this.currency = additionalShopData.currency ?? ShopCurrency.MONEY;
		this.additionalShopData = additionalShopData;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorShopPacket {
		const reactions = [];
		for (const shopCategory of this.shopCategories) {
			for (const shopItem of shopCategory.items) {
				for (const amount of shopItem.amounts) {
					reactions.push(this.buildReaction(ReactionCollectorShopItemReaction, {
						shopCategoryId: shopCategory.id,
						shopItemId: shopItem.id,
						price: shopItem.price * amount,
						amount
					}));
				}
			}
		}

		reactions.push(this.buildReaction(ReactionCollectorShopCloseReaction, {}));

		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorShopData, {
				availableCurrency: this.availableCurrency,
				currency: this.currency,
				additionalShopData: this.additionalShopData
			})
		};
	}
}
