import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { ChestSlotsPerCategory } from "../../types/HomeFeatures";
import {
	ChestAction, HomeConstants
} from "../../constants/HomeConstants";
import { GardenConstants } from "../../constants/GardenConstants";
import {
	GuildBuilding, GuildDomainError
} from "../../constants/GuildDomainConstants";
import { ItemSlot } from "../../types/ItemSlot";
import { CookingOutputTypeValue } from "../../constants/CookingConstants";
import { PlantId } from "../../constants/PlantConstants";
import {
	PlantStorageEntry, PlayerPlantSlotEntry
} from "../../types/PlantStorageEntry";
import { PetFood } from "../../types/PetFood";
import { MaterialQuantity } from "../../types/MaterialQuantity";
import { ApartmentLocationRef } from "../../types/ApartmentLocation";
export {
	CookingSlotData, CookingCraftErrors, CookingCraftError, PinnedRecipeInfo, RecipeIngredients, CookingMenuSnapshot
} from "../../types/CookingTypes";
import {
	CookingCraftError, CookingMenuSnapshot
} from "../../types/CookingTypes";

export type ChestError = typeof HomeConstants.CHEST_ERRORS[keyof typeof HomeConstants.CHEST_ERRORS];
export type { ChestAction } from "../../constants/HomeConstants";

export type GardenError = typeof GardenConstants.GARDEN_ERRORS[keyof typeof GardenConstants.GARDEN_ERRORS];

export type PlantTransferAction = typeof HomeConstants.PLANT_TRANSFER_ACTIONS[keyof typeof HomeConstants.PLANT_TRANSFER_ACTIONS];

export type PlantTransferError = typeof HomeConstants.PLANT_TRANSFER_ERRORS[keyof typeof HomeConstants.PLANT_TRANSFER_ERRORS];

export type { ItemSlot };

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportPacketReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportTravelSummaryRes extends CrowniclesPacket {
	startMap!: {
		id: number;
		type: string;
	};

	endMap!: {
		id: number;
		type: string;
	};

	startTime!: number;

	arriveTime!: number;

	nextStopTime!: number;

	isOnBoat!: boolean;

	effect?: string;

	effectDuration?: number;

	effectEndTime?: number;

	points!: {
		show: boolean;
		cumulated: number;
	};

	energy!: {
		show: boolean;
		current: number;
		max: number;
	};

	lastSmallEventId?: string;

	tokens?: {
		cost: number;
		canAfford: boolean;
	};

	heal?: {
		price: number;
		canAfford: boolean;
	};

	isInCity!: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportMonsterRewardRes extends CrowniclesPacket {
	money!: number;

	experience!: number;

	guildXp!: number;

	guildPoints!: number;

	petReaction?: {
		reactionType: string;
		loveDelta: number;
		petId: number;
		petSex: string;
		petNickname?: string;
	};

	materialLoot?: MaterialQuantity[];
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportErrorNoMonsterRes extends CrowniclesPacket {

}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportRefusePveFightRes extends CrowniclesPacket {

}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportChooseDestinationRes extends CrowniclesPacket {
	mapId!: number;

	mapTypeId!: string;

	tripDuration!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBigEventResultRes extends CrowniclesPacket {
	eventId!: number;

	possibilityId!: string;

	outcomeId!: string;

	score!: number;

	experience!: number;

	effect?: {
		name: string;
		time: number;
	};

	health!: number;

	money!: number;

	energy!: number;

	gems!: number;

	tokens!: number;

	oneshot!: boolean;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportUseTokensPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportUseTokensAcceptPacketRes extends CrowniclesPacket {
	tokensSpent!: number;

	isArrived!: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportUseTokensRefusePacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportTokenMerchantBoughtRes extends CrowniclesPacket {
	amount!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportTokenMerchantTooMuchRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportTokenMerchantFullRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportTokenMerchantRefuseRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportTokenMerchantCannotAffordRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportTokenMerchantCharityRes extends CrowniclesPacket {
	amount!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportTokenMerchantCharityAlreadyUsedRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportBuyHealPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBuyHealAcceptPacketRes extends CrowniclesPacket {
	healPrice!: number;

	isArrived!: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBuyHealRefusePacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBuyHealNoAlterationPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBuyHealCannotHealOccupiedPacketRes extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportStayInCity extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportEatInnMealRes extends CrowniclesPacket {
	energy!: number;

	moneySpent!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportEatInnMealCooldownRes extends CrowniclesPacket {
	nextAvailableAt!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportSleepRoomRes extends CrowniclesPacket {
	roomId!: string;

	health!: number;

	moneySpent!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportNotEnoughMoneyRes extends CrowniclesPacket {
	missingMoney!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportEnchantNotEnoughCurrenciesRes extends CrowniclesPacket {
	missingMoney!: number;

	missingGems!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportItemCannotBeEnchantedRes extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportItemEnchantedRes extends CrowniclesPacket {
	enchantmentId!: string;

	enchantmentType!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBuyHomeRes extends CrowniclesPacket {
	cost!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportUpgradeHomeRes extends CrowniclesPacket {
	cost!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportMoveHomeRes extends CrowniclesPacket {
	cost!: number;

	/** Amount of accumulated apartment rent applied as discount on the move price. Omitted when 0. */
	rentDeducted?: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportUpgradeItemRes extends CrowniclesPacket {
	itemCategory!: number;

	newItemLevel!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportUpgradeItemMissingMaterialsRes extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportUpgradeItemMaxLevelRes extends CrowniclesPacket {}

// Blacksmith packets

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBlacksmithUpgradeRes extends CrowniclesPacket {
	itemCategory!: number;

	newItemLevel!: number;

	/** Total gold spent (upgrade cost + materials if bought) */
	totalCost!: number;

	/** Whether materials were purchased from the blacksmith */
	boughtMaterials!: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBlacksmithNotEnoughMoneyRes extends CrowniclesPacket {
	/** Amount of money missing */
	missingMoney!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBlacksmithMissingMaterialsRes extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBlacksmithDisenchantRes extends CrowniclesPacket {
	itemCategory!: number;

	/** Gold cost paid for disenchanting */
	cost!: number;
}

// Royal Blacksmith packets — special NPC at the royal castle that only upgrades items to level 5.

/** Successful Royal Blacksmith upgrade to level 5. */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportRoyalBlacksmithUpgradeRes extends CrowniclesPacket {
	itemCategory!: number;

	/** Gold cost component of the total. */
	upgradeCost!: number;

	/** Gold spent on materials bought from the Royal Blacksmith (0 if none). */
	materialsCost!: number;

	/** Gem cost (separate from gold). */
	gemCost!: number;

	/** Whether materials were purchased from the Royal Blacksmith. */
	boughtMaterials!: boolean;
}

/** Royal Blacksmith refused the upgrade because the player has insufficient gold. */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportRoyalBlacksmithNotEnoughMoneyRes extends CrowniclesPacket {
	missingMoney!: number;
}

/** Royal Blacksmith refused because the player has insufficient gems. */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportRoyalBlacksmithNotEnoughGemsRes extends CrowniclesPacket {
	missingGems!: number;
}

/** Royal Blacksmith refused because the player is missing materials and did not buy them. */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportRoyalBlacksmithMissingMaterialsRes extends CrowniclesPacket {}

/**
 * Royal Blacksmith upgraded a low-rarity (< RARE) item to level 5 and granted the
 * `SENTIMENTAL_CRAFTER` badge to the player (first time).
 * Sent in addition to the upgrade success packet.
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportRoyalBlacksmithMockBadgeGivenRes extends CrowniclesPacket {}

/**
 * Royal Blacksmith upgraded a low-rarity item to level 5 again — player already
 * had the badge, so they get nothing but extra mockery.
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportRoyalBlacksmithMockBadgeAlreadyOwnedRes extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportHomeBedRes extends CrowniclesPacket {
	health!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportHomeBedAlreadyFullRes extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportBedCooldownRes extends CrowniclesPacket {
	/** UNIX timestamp (ms) at which the player can use a bed again */
	nextAvailableAt!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportApartmentBuyRes extends CrowniclesPacket implements ApartmentLocationRef {
	cityId!: string;

	mapLocationId!: number;

	cost!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportApartmentClaimRentRes extends CrowniclesPacket implements ApartmentLocationRef {
	cityId!: string;

	mapLocationId!: number;

	rentClaimed!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportApartmentClaimRentTooLowRes extends CrowniclesPacket implements ApartmentLocationRef {
	cityId!: string;

	mapLocationId!: number;

	currentRent!: number;

	minRequired!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportApartmentAlreadyOwnedRes extends CrowniclesPacket implements ApartmentLocationRef {
	cityId!: string;

	mapLocationId!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportApartmentRequiresHomeRes extends CrowniclesPacket implements ApartmentLocationRef {
	cityId!: string;

	mapLocationId!: number;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportHomeChestActionReq extends CrowniclesPacket {
	action!: ChestAction;

	/** The inventory slot (for deposit/swap) or chest slot (for withdraw) */
	slot!: number;

	itemCategory!: number;

	/** The chest slot to swap with (only for swap action, -1 otherwise) */
	chestSlot!: number;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportHomeChestActionRes extends CrowniclesPacket {
	/** Whether the action succeeded */
	success!: boolean;

	/** Error type if failed */
	error?: ChestError;

	/** Refreshed chest items list */
	chestItems!: ItemSlot[];

	/** Refreshed depositable items from inventory */
	depositableItems!: ItemSlot[];

	/** Slots per category (unchanged but included for completeness) */
	slotsPerCategory!: ChestSlotsPerCategory;

	/** Max backup slots per category in the player's inventory */
	inventoryCapacity!: ChestSlotsPerCategory;
}

// Garden packets

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportGardenHarvestReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.NONE)
export class CommandReportGardenHarvestRes extends CrowniclesPacket {
	/** Number of plants successfully stored in the chest */
	plantsHarvested!: number;

	/** Number of plants that didn't fit and were composted */
	plantsComposted!: number;

	/** Materials generated from composting (plantId -> materialId) */
	compostResults!: {
		plantId: PlantId;
		materialId: number;
	}[];

	/** Updated plant storage after harvest */
	plantStorage!: PlantStorageEntry[];

	/** Slots that were harvested (reset to growing) */
	harvestedSlots!: number[];
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportGardenPlantReq extends CrowniclesPacket {
	/** The garden slot to plant in */
	gardenSlot!: number;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportGardenPlantRes extends CrowniclesPacket {
	/** The plant type that was planted */
	plantId!: PlantId;

	/** The garden slot that was planted */
	gardenSlot!: number;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportGardenWaterReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.NONE)
export class CommandReportGardenWaterRes extends CrowniclesPacket {
	/** Number of growing slots whose growth was advanced */
	slotsWatered!: number;

	/** Unix-ms timestamp at which the next watering becomes available */
	nextWateringAvailableAt!: number;

	/** Number of slots that became ready thanks to this watering */
	slotsBecameReady!: number;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportGardenErrorRes extends CrowniclesPacket {
	error!: GardenError;

	/** Unix-ms timestamp at which the action becomes available again (when applicable, e.g. on cooldown) */
	availableAt?: number;
}

/**
 * Result packet for a successful manual compost action.
 * Sent when the player confirms composting N plants from the home storage,
 * which terminates the `/rapport` command (mirror of the shop purchase flow).
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportGardenCompostRes extends CrowniclesPacket {
	/** The plant type that was composted */
	plantId!: PlantId;

	/** Number of plants composted (equals materials.length) */
	quantity!: number;

	/** Materials produced — one per composted plant, picked at random in `plant.compostMaterials` */
	materials!: number[];
}

/**
 * Error packet for the manual compost flow, raised when the storage no longer
 * holds enough plants of the requested type (typically due to a concurrent
 * shard composting / harvesting between the menu render and confirmation).
 * Kept distinct from {@link CommandReportGardenErrorRes} because the manual
 * compost flow terminates `/rapport` via a reaction collector, so its response
 * packets must not be picked up by the async-request/response handlers used
 * by harvest / water / plant.
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportGardenCompostNotEnoughPlantsRes extends CrowniclesPacket {
	plantId!: PlantId;

	quantity!: number;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportPlantTransferReq extends CrowniclesPacket {
	/** The transfer action: deposit or withdraw */
	action!: PlantTransferAction;

	/** The plant type to transfer (required for withdraw; ignored for deposit) */
	plantId!: PlantId | 0;

	/** The player slot involved (for deposit: source slot; for withdraw: target slot) */
	playerSlot!: number;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportPlantTransferRes extends CrowniclesPacket {
	success!: boolean;

	error?: PlantTransferError;

	/** Updated plant storage after transfer */
	plantStorage!: PlantStorageEntry[];

	/** Updated player plant slots after transfer */
	playerPlantSlots!: PlayerPlantSlotEntry[];
}

// ---- Cooking packets ----

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportCookingIgniteReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.NONE)
export class CommandReportCookingWoodConfirmReq extends CrowniclesPacket {
	woodMaterialId!: number;

	woodRarity!: number;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportCookingWoodConfirmRes extends CrowniclesPacket {
	accepted!: boolean;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportCookingIgniteRes extends CrowniclesPacket {
	woodConsumed!: boolean;

	woodMaterialId!: number;

	menu!: CookingMenuSnapshot;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportCookingNoWoodRes extends CrowniclesPacket {}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportCookingReviveReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.NONE)
export class CommandReportCookingReviveRes extends CrowniclesPacket {
	woodConsumed!: boolean;

	woodMaterialId!: number;

	menu!: CookingMenuSnapshot;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportCookingCraftReq extends CrowniclesPacket {
	slotIndex!: number;
}

export interface CraftPetFoodResult {
	type: PetFood;
	quantity: number;
	storedQuantity: number;
	fedFromSurplus?: boolean;
	surplusMaterialId?: number;
	surplusMaterialQuantity?: number;
}

export interface CraftMaterialResult {
	materialId: number;
	quantity: number;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportCookingCraftRes extends CrowniclesPacket {
	success!: boolean;

	recipeId!: string;

	wasSecret!: boolean;

	outputType!: CookingOutputTypeValue;

	potionId?: number;

	petFood?: CraftPetFoodResult;

	material?: CraftMaterialResult;

	failedPotionId?: number;

	cookingXpGained!: number;

	cookingLevelUp!: boolean;

	newCookingLevel?: number;

	newCookingGrade?: string;

	materialSaved?: number;

	bonusOutput?: boolean;

	discoveredRecipeIds?: string[];

	error?: CookingCraftError;

	menu!: CookingMenuSnapshot;
}

// ---- Cooking menu & pin packets ----

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportCookingMenuReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.NONE)
export class CommandReportCookingMenuRes extends CrowniclesPacket {
	menu!: CookingMenuSnapshot;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportCookingPinReq extends CrowniclesPacket {
	recipeId!: string;

	/** Whether the player issued the pin from the ignited menu (drives post-pin re-render). */
	fromIgnitedView!: boolean;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportCookingPinRes extends CrowniclesPacket {
	menu!: CookingMenuSnapshot;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportCookingUnpinReq extends CrowniclesPacket {
	/** Whether the player issued the unpin from the ignited menu (drives post-unpin re-render). */
	fromIgnitedView!: boolean;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportCookingUnpinRes extends CrowniclesPacket {
	menu!: CookingMenuSnapshot;
}

// ---- Castle boss archivist packets ----

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportBossPersonalRecordsReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.NONE)
export class CommandReportBossPersonalRecordsRes extends CrowniclesPacket {
	personalRecords!: import("../../types/PveBossRecord").PveBossPersonalRecord[];

	maximumTierClassIds!: number[];
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportBossLeaderboardReq extends CrowniclesPacket {
	monsterId!: import("../../types/PveBossRecord").FinalPveBossId;

	classId!: number;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportBossLeaderboardRes extends CrowniclesPacket {
	monsterId!: import("../../types/PveBossRecord").FinalPveBossId;

	classId!: number;

	entries!: import("../../types/PveBossRecord").PveBossLeaderboardEntry[];
}

// Guild domain notary packets

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportGuildDomainPurchaseRes extends CrowniclesPacket {
	cost!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportGuildDomainRelocateRes extends CrowniclesPacket {
	cost!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportGuildDomainNotEnoughTreasuryRes extends CrowniclesPacket {
	missingTreasury!: number;
}

// Guild domain interactive packets (async bidirectional)

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportGuildDomainUpgradeReq extends CrowniclesPacket {
	building!: GuildBuilding;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportGuildDomainUpgradeRes extends CrowniclesPacket {
	building!: GuildBuilding;

	newLevel!: number;

	cost!: number;

	newTreasury!: number;

	xpGained!: number;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportGuildDomainUpgradeErrorRes extends CrowniclesPacket {
	error!: GuildDomainError;
}

// Guild food shop packets (for buying food from non-domain cities)

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportFoodShopBuyReq extends CrowniclesPacket {
	foodType!: PetFood;

	amount!: number;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportFoodShopBuyRes extends CrowniclesPacket {
	foodType!: PetFood;

	newFoodStock!: number;

	newTreasury!: number;

	amountBought!: number;

	totalCost!: number;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportFoodShopBuyErrorRes extends CrowniclesPacket {
	error!: GuildDomainError;
}

// Guild domain shop treasury deposit packets

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportGuildDomainDepositTreasuryReq extends CrowniclesPacket {
	amount!: number;

	/** When true, the deposit is treated as a refund of a previous treasury withdrawal: no commission is taken. */
	isReimburse?: boolean;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportGuildDomainDepositTreasuryRes extends CrowniclesPacket {
	treasuryDeposited!: number;

	newPlayerMoney!: number;

	newTreasury!: number;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportGuildDomainDepositTreasuryErrorRes extends CrowniclesPacket {
	error!: GuildDomainError;
}
