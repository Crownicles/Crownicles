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
import { ShopItemType } from "../../constants/LogsConstants";

export interface ShopItem {
	id: ShopItemType;

	price: number;

	amounts: number[];

	buyCallback: (response: CrowniclesPacket[], player: number, context: PacketContext, amount: number) => boolean | Promise<boolean>;
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
export class CommandShopNotEnoughCurrency extends CrowniclesPacket {
	missingCurrency!: number;

	currency!: ShopCurrency;
}

export class ReactionCollectorShopData extends ReactionCollectorData {
	availableCurrency!: number;

	currency!: ShopCurrency;

	additionalShopData?: additionalShopData;
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
