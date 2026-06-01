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
import {
	HomeFeatures, ChestSlotsPerCategory
} from "../../types/HomeFeatures";
import {
	BuildingUpgradeEligibilityMap, DepositTierAffordability
} from "../../types/GuildDomainEligibility";
import { MaterialRarity } from "../../types/MaterialRarity";
import { ItemSlot } from "../../types/ItemSlot";
import { PlantId } from "../../constants/PlantConstants";
import {
	PlantStorageEntry, PlayerPlantSlotEntry
} from "../../types/PlantStorageEntry";
import { OwnedPet } from "../../types/OwnedPet";
import { OwnedApartmentSummary } from "../../types/ApartmentLocation";
import { GardenAccessMode } from "../../types/GardenAccessMode";
import { GardenConstants } from "../../constants/GardenConstants";

export class ReactionCollectorCityData extends ReactionCollectorData {
	mapTypeId!: string;

	mapLocationId!: number;

	enterCityTimestamp!: number;

	/**
	 * If set, the Discord side should auto-navigate to this menu after rendering.
	 * Used to keep the player in the chest menu after a deposit/withdraw action.
	 */
	initialMenu?: string;

	/**
	 * Set when the city menu is reopened after closing a city shop.
	 * Discord should then render on the shop message itself.
	 */
	reopenedFromShop?: boolean;

	/**
	 * Standalone mode used by the /garden command.
	 * When true:
	 * - Lib emits only the garden home reactions plus a single "close" (refuse) reaction.
	 * - Discord MainMenu renders a minimal close-only screen.
	 * The collector reuses the city payload schema but is conceptually a garden-only window.
	 */
	gardenOnly?: boolean;

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
		isEmpty?: boolean;
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
		unenchantedItemsInOtherSlotCount: number; // Number of unenchanted items the player has in the wrong slot for today's enchantment (used for plural rendering in stories).
		enchantmentId: string;
		enchantmentType: string;
		enchantmentSlot: ItemCategory; // The slot (WEAPON or ARMOR) that today's enchantment can be applied to.
		enchantmentCost: {
			money: number;
			gems: number;
		};
		mageReduction: boolean;

		playerMoney: number;

		playerGems: number;
	};

	home!: {
		owned?: {
			level: number;

			/** True when this `owned` entry describes a remote apartment (logis), not the player's main home. */
			isApartment?: boolean;
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
			chest?: {
				chestItems: ItemSlot[];
				depositableItems: ItemSlot[];
				slotsPerCategory: ChestSlotsPerCategory;

				/** Max backup slots per category in the player's inventory */
				inventoryCapacity: ChestSlotsPerCategory;

				/** Plant storage in the chest (quantities per plant type) */
				plantStorage?: PlantStorageEntry[];

				/** Player's carried plant slots */
				playerPlantSlots?: PlayerPlantSlotEntry[];

				/** Maximum capacity per plant type (homeLevel * 1) */
				plantMaxCapacity?: number;
			};

			garden?: {

				/** Garden plot status */
				plots: {
					slot: number;
					plantId: PlantId | 0;
					growthProgress: number;
					isReady: boolean;

					/** Unix timestamp (seconds) at which the plant will be ready, 0 if no plant or already ready */
					readyAtTimestamp: number;
				}[];

				/** Plant storage (chest) quantities per plant type */
				plantStorage: PlantStorageEntry[];

				/** Whether the player has a seed to plant */
				hasSeed: boolean;

				/** The seed plant type the player is carrying (0 if none) */
				seedPlantId: PlantId | 0;

				/** Total garden plots available */
				totalPlots: number;

				/** Garden access level — full UI vs harvest-only when accessing remotely with talisman */
				accessMode: GardenAccessMode;

				/** Watering state: unix-ms when watering becomes available again (null = available now) */
				wateringAvailableAt: number | null;

				/**
				 * Pre-computed action eligibility. Discord uses these booleans
				 * directly to enable/disable buttons — domain rules
				 * (read-only mode, seed presence, free plots, water cooldown,
				 * compost stock) live in Core only.
				 */
				eligibility: {
					canHarvest: boolean;
					canPlantSeed: boolean;
					canWaterGarden: boolean;
					canCompost: boolean;
				};
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

			/** Core-authoritative eligibility: player can buy a new home (newPrice set and affordable) */
			canBuy?: boolean;

			/** Core-authoritative eligibility: player can upgrade their home (upgrade set and affordable) */
			canUpgrade?: boolean;

			/** Core-authoritative eligibility: player can move their home (movePrice set and affordable) */
			canMove?: boolean;

			/** When no actions are available, the required player level for the next home upgrade */
			requiredPlayerLevelForUpgrade?: number;

			/** Whether the home is at max level */
			isMaxLevel?: boolean;
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

			/** Core-authoritative eligibility: player can directly upgrade (has materials and gold) */
			canUpgrade: boolean;

			/** Core-authoritative eligibility: player can buy missing materials and upgrade (gold covers both) */
			canBuyAndUpgrade: boolean;
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

			/** Core-authoritative eligibility: player has enough gold to disenchant */
			canDisenchant: boolean;
		}[];

		/** Current player money for UI display */
		playerMoney: number;
	};

	/**
	 * Royal Blacksmith data — only present at the royal castle.
	 * Drives the special level-5-only upgrade NPC: see RoyalBlacksmithConstants.
	 *
	 * `status` is computed by Core based on player level and inventory state
	 * so Discord can pick the right narrative menu without re-implementing
	 * the eligibility rules.
	 */
	royalBlacksmith?: {

		/**
		 * - `not_worthy`: player level < MIN_PLAYER_LEVEL
		 * - `items_too_low`: player has no item upgradable to level 5 (no L4 weapon/armor, and not all-L5 either)
		 * - `all_maxed`: every weapon/armor the player holds is already at level 5
		 * - `ready`: at least one item can be upgraded; `upgradeableItems` is non-empty
		 */
		status: "not_worthy" | "items_too_low" | "all_maxed" | "ready";

		/** Player level snapshot — used for the "not worthy" RP message. */
		playerLevel: number;

		/** Items currently at level 4 that the Royal Blacksmith can push to level 5. */
		upgradeableItems: {
			slot: number;
			category: ItemCategory;
			details: MainItemDetails;

			/** Gold cost (formula same as standard blacksmith for target level 5). */
			upgradeCost: number;

			/** Extra gem cost (RoyalBlacksmithConstants.GEM_COST_PER_RARITY[itemRarity]). */
			gemCost: number;

			/** Rarity of the item — used to apply the easter-egg "mocking badge" rule. */
			itemRarity: number;

			/** Materials required (same shape as the standard blacksmith). */
			requiredMaterials: {
				materialId: number;
				rarity: MaterialRarity;
				quantity: number;
				playerQuantity: number;
			}[];

			/** Total cost to buy missing materials from the Royal Blacksmith. */
			missingMaterialsCost: number;

			/** Whether the player has all required materials. */
			hasAllMaterials: boolean;

			/** Player can upgrade directly (materials + gold + gems all covered). */
			canUpgrade: boolean;

			/** Player can buy missing materials and upgrade (gold covers both, plus gems). */
			canBuyAndUpgrade: boolean;
		}[];

		/** Player money snapshot for UI display. */
		playerMoney: number;

		/** Player gems snapshot for UI display. */
		playerGems: number;
	};

	/**
	 * Guild domain data - shown when the guild has its domain in this city
	 */
	guildDomain?: {

		/** Whether the player's guild has its domain in this city */
		isInCity: boolean;

		/** Guild name */
		guildName: string;

		/** Building levels */
		shopLevel: number;
		shelterLevel: number;
		pantryLevel: number;
		trainingGroundLevel: number;

		/** Guild level (for upgrade requirements) */
		guildLevel: number;

		/** Treasury balance */
		treasury: number;

		/** Player money */
		playerMoney: number;

		/** Whether the player is the guild chief */
		isChief: boolean;

		/** Whether the player is the guild elder */
		isElder: boolean;

		/** Food storage */
		food: {
			common: number;
			carnivorous: number;
			herbivorous: number;
			ultimate: number;
		};

		/** Food caps based on pantry level */
		foodCaps: readonly number[];

		/** Max quantity of each food the guild can currently buy from its treasury (clamped by remaining cap and unit price). */
		maxBuyableFood: readonly number[];

		/** Pets currently in the guild shelter */
		shelterPets: OwnedPet[];

		/** Maximum number of pets the shelter can hold */
		shelterMaxCount: number;

		/**
		 * Per-building upgrade eligibility computed by Core.
		 * `null` means the building is already at max level.
		 * `canAfford` = treasury covers the upgrade cost.
		 * `meetsLevel` = guild level satisfies the required level.
		 */
		canUpgradeBuildings: BuildingUpgradeEligibilityMap;

		/** Whether the player can afford each treasury deposit tier (computed by Core). */
		canDeposit: DepositTierAffordability;
	};

	/**
	 * Guild food shop - shown when the player has a guild with a shop but is NOT in the domain city
	 */
	guildFoodShop?: {

		/** Guild name */
		guildName: string;

		/** Food storage */
		food: {
			common: number;
			carnivorous: number;
			herbivorous: number;
			ultimate: number;
		};

		/** Food caps based on pantry level */
		foodCaps: readonly number[];

		/** Max quantity of each food the guild can currently buy from its treasury (clamped by remaining cap and unit price). */
		maxBuyableFood: readonly number[];

		/** Player money */
		playerMoney: number;

		/** Guild treasury balance (used to fund purchases) */
		treasury: number;
	};

	/**
	 * Guild domain notary options - shown when the player is a guild chief
	 */
	guildDomainNotary?: {

		/** Whether the guild already has a domain */
		hasDomain: boolean;

		/** Cost to purchase (first time) or relocate */
		cost: number;

		/** Guild treasury balance */
		treasury: number;

		/** Whether the player is the guild chief */
		isChief: boolean;

		/** Core-authoritative eligibility: guild treasury covers the cost */
		canAfford: boolean;
	};

	/**
	 * Apartment notary options - shown in every city.
	 * Lets the player buy a new apartment here and/or claim rent
	 * from apartments they own in other cities.
	 */
	apartmentNotary!: {

		/**
		 * Apartment for sale in this city. Absent if player already owns one here, or city has no apartmentPrice.
		 * Discriminated by `canAfford`: when `false`, `missingMoney` is required.
		 */
		forSale?:
			| {
				price: number; canAfford: true;
			}
			| {
				price: number; canAfford: false; missingMoney: number;
			};

		/** Apartments owned by the player, with their current accumulated rent. */
		ownedApartments: OwnedApartmentSummary[];
	};
}

export type EnchanterCityData = NonNullable<ReactionCollectorCityData["enchanter"]>;

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

/** Reaction for opening the Royal Blacksmith menu at the royal castle */
export class ReactionCollectorRoyalBlacksmithMenuReaction extends ReactionCollectorReaction {}

/** Reaction for upgrading an item to level 5 at the Royal Blacksmith */
export class ReactionCollectorRoyalBlacksmithUpgradeReaction extends ReactionCollectorReaction {
	slot!: number;

	itemCategory!: ItemCategory;

	/** Whether to buy missing materials before upgrading */
	buyMaterials!: boolean;
}

/** Reaction for harvesting all ready plants from the garden */
export class ReactionCollectorGardenHarvestReaction extends ReactionCollectorReaction {}

/** Reaction for watering the garden (advance growth of all growing plants) */
export class ReactionCollectorGardenWaterReaction extends ReactionCollectorReaction {}

/**
 * Reaction for manually composting plants from the home plant storage.
 * Consumes `quantity` plants of `plantId` and gives one random material per plant.
 * Only emitted when the player is physically at home (`accessMode === FULL`).
 */
export class ReactionCollectorGardenCompostReaction extends ReactionCollectorReaction {
	plantId!: PlantId;

	quantity!: number;
}

/** Reaction for opening the guild domain menu (player is in the domain's city) */
export class ReactionCollectorGuildDomainMenuReaction extends ReactionCollectorReaction {}

/** Reaction for purchasing or relocating the guild domain via the notary */
export class ReactionCollectorGuildDomainNotaryReaction extends ReactionCollectorReaction {}

/** Reaction for purchasing an apartment in the current city */
export class ReactionCollectorApartmentBuyReaction extends ReactionCollectorReaction {}

/** Reaction for claiming the accumulated rent of a specific apartment */
export class ReactionCollectorApartmentClaimRentReaction extends ReactionCollectorReaction {
	apartmentId!: number;
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
	| ReactionCollectorBlacksmithDisenchantReaction
	| ReactionCollectorRoyalBlacksmithMenuReaction
	| ReactionCollectorRoyalBlacksmithUpgradeReaction
	| ReactionCollectorGardenHarvestReaction
	| ReactionCollectorGardenWaterReaction
	| ReactionCollectorGardenCompostReaction
	| ReactionCollectorGuildDomainMenuReaction
	| ReactionCollectorGuildDomainNotaryReaction
	| ReactionCollectorApartmentBuyReaction
	| ReactionCollectorApartmentClaimRentReaction;

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
		return this.data.shops
			.filter(shop => !shop.isEmpty)
			.map(shop =>
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

		// Bed regen is suppressed in remote-garden (read-only) access: the player isn't physically home.
		const isRemoteGardenView = this.data.home.owned.garden?.accessMode === GardenAccessMode.READ_ONLY;
		const homeBedReactions = isRemoteGardenView
			? []
			: [this.buildReaction(ReactionCollectorHomeBedReaction, {})];
		const upgradeItemReactions = this.data.home.owned.upgradeStation?.upgradeableItems.map(item =>
			this.buildReaction(ReactionCollectorUpgradeItemReaction, {
				slot: item.slot,
				itemCategory: item.category
			})) ?? [];

		const gardenReactions = this.buildGardenReactions();

		return [
			homeMenuReaction,
			...homeBedReactions,
			...upgradeItemReactions,
			...gardenReactions
		];
	}

	private buildGardenReactions(): {
		type: string; data: ReactionCollectorReaction;
	}[] {
		const garden = this.data.home.owned?.garden;
		if (!garden) {
			return [];
		}
		const reactions: {
			type: string; data: ReactionCollectorReaction;
		}[] = [];

		// Harvest reaction (always available if garden exists)
		reactions.push(this.buildReaction(ReactionCollectorGardenHarvestReaction, {}));

		// Water reaction only when the player is physically in their home (full access)
		if (garden.accessMode === GardenAccessMode.FULL) {
			reactions.push(this.buildReaction(ReactionCollectorGardenWaterReaction, {}));
		}

		/*
		 * Manual compost reactions: only when the player is physically home and has plants in storage.
		 * Emit one reaction per (plantId, quantity ∈ COMPOST_QUANTITIES with quantity ≤ stored quantity)
		 * so the Discord side can pick the right index without re-validating storage state.
		 */
		if (garden.accessMode === GardenAccessMode.FULL) {
			for (const entry of garden.plantStorage) {
				if (entry.quantity <= 0) {
					continue;
				}
				for (const quantity of GardenConstants.COMPOST_QUANTITIES) {
					if (entry.quantity >= quantity) {
						reactions.push(this.buildReaction(ReactionCollectorGardenCompostReaction, {
							plantId: entry.plantId,
							quantity
						}));
					}
				}
			}
		}
		return reactions;
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

	private buildGuildDomainReactions(): {
		type: string; data: ReactionCollectorReaction;
	}[] {
		const reactions: {
			type: string; data: ReactionCollectorReaction;
		}[] = [];

		if (this.data.guildDomain?.isInCity) {
			reactions.push(this.buildReaction(ReactionCollectorGuildDomainMenuReaction, {}));
		}

		if (this.data.guildDomainNotary?.isChief) {
			reactions.push(this.buildReaction(ReactionCollectorGuildDomainNotaryReaction, {}));
		}

		return reactions;
	}

	private buildRoyalBlacksmithReactions(): {
		type: string; data: ReactionCollectorReaction;
	}[] {
		if (!this.data.royalBlacksmith) {
			return [];
		}

		const menuReaction = this.buildReaction(ReactionCollectorRoyalBlacksmithMenuReaction, {});

		const upgradeReactions = this.data.royalBlacksmith.upgradeableItems.flatMap(item => [
			this.buildReaction(ReactionCollectorRoyalBlacksmithUpgradeReaction, {
				slot: item.slot,
				itemCategory: item.category,
				buyMaterials: false
			}),
			this.buildReaction(ReactionCollectorRoyalBlacksmithUpgradeReaction, {
				slot: item.slot,
				itemCategory: item.category,
				buyMaterials: true
			})
		]);

		return [menuReaction, ...upgradeReactions];
	}

	private buildApartmentNotaryReactions(): {
		type: string; data: ReactionCollectorReaction;
	}[] {
		const notary = this.data.apartmentNotary;
		const reactions: {
			type: string; data: ReactionCollectorReaction;
		}[] = [];

		if (notary.forSale) {
			reactions.push(this.buildReaction(ReactionCollectorApartmentBuyReaction, {}));
		}

		for (const owned of notary.ownedApartments) {
			reactions.push(this.buildReaction(ReactionCollectorApartmentClaimRentReaction, {
				apartmentId: owned.apartmentId
			}));
		}

		return reactions;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCityPacket {
		const reactions = this.data.gardenOnly
			? [
				this.buildReaction(ReactionCollectorRefuseReaction, {}),
				...this.buildHomeFeatureReactions()
			]
			: [
				this.buildReaction(ReactionCollectorExitCityReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {}),
				...this.buildInnReactions(),
				...this.buildEnchanterReactions(),
				...this.buildShopReactions(),
				...this.buildHomeManageReaction(),
				...this.buildHomeFeatureReactions(),
				...this.buildBlacksmithReactions(),
				...this.buildRoyalBlacksmithReactions(),
				...this.buildGuildDomainReactions(),
				...this.buildApartmentNotaryReactions()
			];
		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorCityData, {
				...this.data
			})
		};
	}
}
