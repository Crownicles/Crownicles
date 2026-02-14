import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import { MainItemDetails } from "../../types/MainItemDetails";
import { MaterialQuantity } from "../../types/MaterialQuantity";
import {
	ItemCategory, ItemRarity
} from "../../constants/ItemConstants";
import { HomeFeatures } from "../../types/HomeFeatures";
import { MaterialRarity } from "../../types/MaterialRarity";

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
					requiredMaterials: (MaterialQuantity & {
						playerQuantity: number;
					})[];
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

	/**
	 * Blacksmith data - available in most cities
	 * Allows upgrading items to level 4 and disenchanting
	 */
	blacksmith?: {

		/** Items that can be upgraded at the blacksmith */
		upgradeableItems: {
			slot: number;
			category: ItemCategory;
			details: MainItemDetails;
			nextLevel: number;

			/** Gold cost for the upgrade */
			upgradeCost: number;

			/** Materials required for the upgrade */
			requiredMaterials: {
				materialId: number;
				rarity: MaterialRarity;
				quantity: number;
				playerQuantity: number;
			}[];

			/** Total cost to buy missing materials from the blacksmith */
			missingMaterialsCost: number;

			/** Whether the player has all required materials */
			hasAllMaterials: boolean;
		}[];

		/** Items that can be disenchanted at the blacksmith */
		disenchantableItems: {
			slot: number;
			category: ItemCategory;
			details: MainItemDetails;
			enchantmentId: string;
			enchantmentType: string;

			/** Gold cost to disenchant this item */
			disenchantCost: number;
		}[];

		/** Current player money for UI display */
		playerMoney: number;
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

export class ReactionCollectorHomeBedReaction extends ReactionCollectorReaction {}

export class ReactionCollectorUpgradeItemReaction extends ReactionCollectorReaction {
	slot!: number;

	itemCategory!: ItemCategory;
}

/** Reaction for opening the blacksmith menu */
export class ReactionCollectorBlacksmithMenuReaction extends ReactionCollectorReaction {}

/** Reaction for upgrading an item at the blacksmith */
export class ReactionCollectorBlacksmithUpgradeReaction extends ReactionCollectorReaction {
	slot!: number;

	itemCategory!: ItemCategory;

	/** Whether to buy missing materials before upgrading */
	buyMaterials!: boolean;
}

/** Reaction for disenchanting an item at the blacksmith */
export class ReactionCollectorBlacksmithDisenchantReaction extends ReactionCollectorReaction {
	slot!: number;

	itemCategory!: ItemCategory;
}

/**
 * Union type for all city reactions
 */
type CityReaction =
	| ReactionCollectorExitCityReaction
	| ReactionCollectorRefuseReaction
	| ReactionCollectorInnMealReaction
	| ReactionCollectorInnRoomReaction
	| ReactionCollectorEnchantReaction
	| ReactionCollectorCityShopReaction
	| ReactionCollectorCityBuyHomeReaction
	| ReactionCollectorCityUpgradeHomeReaction
	| ReactionCollectorCityMoveHomeReaction
	| ReactionCollectorHomeMenuReaction
	| ReactionCollectorUpgradeItemReaction
	| ReactionCollectorBlacksmithMenuReaction
	| ReactionCollectorBlacksmithUpgradeReaction
	| ReactionCollectorBlacksmithDisenchantReaction;

/**
 * Packet type for the city reaction collector
 */
export type ReactionCollectorCityPacket = ReactionCollectorCreationPacket<
	ReactionCollectorCityData,
	CityReaction
>;

export class ReactionCollectorCity extends ReactionCollector {
	private readonly data!: ReactionCollectorCityData;

	constructor(data: ReactionCollectorCityData) {
		super();
		this.data = data;
	}

	private buildInnReactions(): {
		type: string; data: ReactionCollectorReaction;
	}[] {
		if (!this.data.inns) {
			return [];
		}
		const mealsReactions = this.data.inns.flatMap(inn =>
			inn.meals.map(meal =>
				this.buildReaction(ReactionCollectorInnMealReaction, {
					innId: inn.innId,
					meal
				})));

		const roomsReactions = this.data.inns.flatMap(inn =>
			inn.rooms.map(room =>
				this.buildReaction(ReactionCollectorInnRoomReaction, {
					innId: inn.innId,
					room
				})));

		return [
			...mealsReactions,
			...roomsReactions
		];
	}

	private buildEnchanterReactions(): {
		type: string; data: ReactionCollectorReaction;
	}[] {
		if (!this.data.enchanter?.enchantableItems) {
			return [];
		}
		return this.data.enchanter.enchantableItems.map(item =>
			this.buildReaction(ReactionCollectorEnchantReaction, {
				slot: item.slot,
				itemCategory: item.category
			}));
	}

	private buildShopReactions(): {
		type: string; data: ReactionCollectorReaction;
	}[] {
		if (!this.data.shops) {
			return [];
		}
		return this.data.shops.map(shop =>
			this.buildReaction(ReactionCollectorCityShopReaction, {
				shopId: shop.shopId
			}));
	}

	private buildHomeManageReaction(): {
		type: string; data: ReactionCollectorReaction;
	}[] {
		const manage = this.data.home.manage;
		if (!manage) {
			return [];
		}
		if (manage.newPrice) {
			return [this.buildReaction(ReactionCollectorCityBuyHomeReaction, {})];
		}
		if (manage.upgrade) {
			return [this.buildReaction(ReactionCollectorCityUpgradeHomeReaction, {})];
		}
		if (manage.movePrice) {
			return [this.buildReaction(ReactionCollectorCityMoveHomeReaction, {})];
		}
		return [];
	}

	private buildHomeFeatureReactions(): {
		type: string; data: ReactionCollectorReaction;
	}[] {
		if (!this.data.home.owned) {
			return [];
		}
		const homeMenuReaction = this.buildReaction(ReactionCollectorHomeMenuReaction, {});
		const homeBedReaction = this.buildReaction(ReactionCollectorHomeBedReaction, {});
		const upgradeItemReactions = this.data.home.owned.upgradeStation?.upgradeableItems.map(item =>
			this.buildReaction(ReactionCollectorUpgradeItemReaction, {
				slot: item.slot,
				itemCategory: item.category
			})) ?? [];

		return [
			homeMenuReaction,
			homeBedReaction,
			...upgradeItemReactions
		];
	}

	private buildBlacksmithReactions(): {
		type: string; data: ReactionCollectorReaction;
	}[] {
		if (!this.data.blacksmith) {
			return [];
		}

		const menuReaction = this.buildReaction(ReactionCollectorBlacksmithMenuReaction, {});

		const upgradeReactions = this.data.blacksmith.upgradeableItems.flatMap(item => [
			this.buildReaction(ReactionCollectorBlacksmithUpgradeReaction, {
				slot: item.slot,
				itemCategory: item.category,
				buyMaterials: false
			}),
			this.buildReaction(ReactionCollectorBlacksmithUpgradeReaction, {
				slot: item.slot,
				itemCategory: item.category,
				buyMaterials: true
			})
		]);

		const disenchantReactions = this.data.blacksmith.disenchantableItems.map(item =>
			this.buildReaction(ReactionCollectorBlacksmithDisenchantReaction, {
				slot: item.slot,
				itemCategory: item.category
			}));

		return [
			menuReaction,
			...upgradeReactions,
			...disenchantReactions
		];
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCityPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorExitCityReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {}),
				...this.buildInnReactions(),
				...this.buildEnchanterReactions(),
				...this.buildShopReactions(),
				...this.buildHomeManageReaction(),
				...this.buildHomeFeatureReactions(),
				...this.buildBlacksmithReactions()
			],
			data: this.buildData(ReactionCollectorCityData, {
				...this.data
			})
		};
	}
}
