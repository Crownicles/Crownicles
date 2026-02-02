import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import { MainItemDetails } from "../../types/MainItemDetails";
import {
	ItemCategory, ItemRarity
} from "../../constants/ItemConstants";
import { HomeFeatures } from "../../types/HomeFeatures";

export class ReactionCollectorCityData extends ReactionCollectorData {
	mapTypeId!: string;

	mapLocationId!: number;

	enterCityTimestamp!: number;

	inns?: {
		innId: string;
		meals: {
			mealId: string;
			price: number;
			energy: number;
		}[];
		rooms: {
			roomId: string;
			price: number;
			health: number;
		}[];
	}[];

	shops?: {
		shopId: string;
	}[];

	energy!: {
		current: number;
		max: number;
	};

	health!: {
		current: number;
		max: number;
	};

	enchanter?: {
		enchantableItems: {
			slot: number;
			category: ItemCategory;
			details: MainItemDetails;
		}[];
		isInventoryEmpty: boolean; // If true, the inventory is empty, and we can't enchant anything. It is used to display the right message.
		hasAtLeastOneEnchantedItem: boolean; // If true, the player has at least one enchanted item, so the enchanter must say that it cannot remove enchantments.
		enchantmentId: string;
		enchantmentType: string;
		enchantmentCost: {
			money: number;
			gems: number;
		};
		mageReduction: boolean;
	};

	home!: {
		owned?: {
			level: number;
			features: HomeFeatures;
			upgradeStation?: {
				upgradeableItems: {
					slot: number;
					category: ItemCategory;
					details: MainItemDetails;
					nextLevel: number;
					requiredMaterials: {
						materialId: number;
						quantity: number;
						playerQuantity: number;
					}[];
					canUpgrade: boolean;
				}[];
				maxUpgradeableRarity: ItemRarity;
			};
		};
		manage?: {
			newPrice?: number;
			upgrade?: {
				price: number;
				oldFeatures: HomeFeatures;
				newFeatures: HomeFeatures;
			};
			movePrice?: number;
			currentMoney: number;
		};
	};
}

export class ReactionCollectorExitCityReaction extends ReactionCollectorReaction {}

export class ReactionCollectorInnMealReaction extends ReactionCollectorReaction {
	innId!: string;

	meal!: {
		mealId: string;
		price: number;
		energy: number;
	};
}

export class ReactionCollectorInnRoomReaction extends ReactionCollectorReaction {
	innId!: string;

	room!: {
		roomId: string;
		price: number;
		health: number;
	};
}

export class ReactionCollectorEnchantReaction extends ReactionCollectorReaction {
	slot!: number;

	itemCategory!: ItemCategory;
}

export class ReactionCollectorCityShopReaction extends ReactionCollectorReaction {
	shopId!: string;
}

export class ReactionCollectorCityBuyHomeReaction extends ReactionCollectorReaction {}

export class ReactionCollectorCityUpgradeHomeReaction extends ReactionCollectorReaction {}

export class ReactionCollectorCityMoveHomeReaction extends ReactionCollectorReaction {}

export class ReactionCollectorHomeMenuReaction extends ReactionCollectorReaction {}

export class ReactionCollectorUpgradeItemReaction extends ReactionCollectorReaction {
	slot!: number;

	itemCategory!: ItemCategory;
}

export class ReactionCollectorCity extends ReactionCollector {
	private readonly data!: ReactionCollectorCityData;

	constructor(data: ReactionCollectorCityData) {
		super();
		this.data = data;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		const mealsReactions = this.data.inns?.flatMap(inn =>
			inn.meals.map(meal =>
				this.buildReaction(ReactionCollectorInnMealReaction, {
					innId: inn.innId,
					meal
				}))) || [];

		const roomsReactions = this.data.inns?.flatMap(inn =>
			inn.rooms.map(room =>
				this.buildReaction(ReactionCollectorInnRoomReaction, {
					innId: inn.innId,
					room
				}))) || [];

		const enchantReactions = this.data.enchanter?.enchantableItems.map(item =>
			this.buildReaction(ReactionCollectorEnchantReaction, {
				slot: item.slot,
				itemCategory: item.category
			})) || [];

		const shopReactions = this.data.shops?.map(shop =>
			this.buildReaction(ReactionCollectorCityShopReaction, {
				shopId: shop.shopId
			})) || [];

		const homeReaction = this.data.home.manage?.newPrice
			? [this.buildReaction(ReactionCollectorCityBuyHomeReaction, {})]
			: this.data.home.manage?.upgrade
				? [this.buildReaction(ReactionCollectorCityUpgradeHomeReaction, {})]
				: this.data.home.manage?.movePrice
					? [this.buildReaction(ReactionCollectorCityMoveHomeReaction, {})]
					: [];

		const homeMenuReaction = this.data.home.owned
			? [this.buildReaction(ReactionCollectorHomeMenuReaction, {})]
			: [];

		const upgradeItemReactions = this.data.home.owned?.upgradeStation?.upgradeableItems.map(item =>
			this.buildReaction(ReactionCollectorUpgradeItemReaction, {
				slot: item.slot,
				itemCategory: item.category
			})) || [];

		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorExitCityReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {}),
				...mealsReactions,
				...roomsReactions,
				...enchantReactions,
				...shopReactions,
				...homeReaction,
				...homeMenuReaction,
				...upgradeItemReactions
			],
			data: this.buildData(ReactionCollectorCityData, {
				...this.data
			})
		};
	}
}
