import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { ChestSlotsPerCategory } from "../../types/HomeFeatures";
import {
        ChestAction, HomeConstants
} from "../../constants/HomeConstants";
import { GardenConstants } from "../../constants/GardenConstants";
import { ItemSlot } from "../../types/ItemSlot";
import { PlantId } from "../../constants/PlantConstants";

export type ChestError = typeof HomeConstants.CHEST_ERRORS[keyof typeof HomeConstants.CHEST_ERRORS];
export type { ChestAction } from "../../constants/HomeConstants";

export type GardenError = typeof GardenConstants.GARDEN_ERRORS[keyof typeof GardenConstants.GARDEN_ERRORS];

export type PlantTransferError = typeof HomeConstants.PLANT_TRANSFER_ERRORS[keyof typeof HomeConstants.PLANT_TRANSFER_ERRORS];

export type { ItemSlot };

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
		playerTokens: number;
	};

	heal?: {
		price: number;
		playerMoney: number;
	};
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
export class CommandReportChooseDestinationCityRes extends CrowniclesPacket {
	mapId!: number;

	mapTypeId!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportEatInnMealRes extends CrowniclesPacket {
	energy!: number;

	moneySpent!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportEatInnMealCooldownRes extends CrowniclesPacket {}

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

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportHomeBedRes extends CrowniclesPacket {
	health!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandReportHomeBedAlreadyFullRes extends CrowniclesPacket {}

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

	/** Materials generated from composting (plantId → materialId) */
	compostResults!: {
		plantId: PlantId;
		materialId: number;
	}[];

	/** Updated plant storage after harvest */
	plantStorage!: {
		plantId: PlantId;
		quantity: number;
		maxCapacity: number;
	}[];

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

@sendablePacket(PacketDirection.NONE)
export class CommandReportGardenPlantErrorRes extends CrowniclesPacket {
	error!: GardenError;
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportPlantTransferReq extends CrowniclesPacket {
	/** "plantDeposit" or "plantWithdraw" */
	action!: string;

	/** The plant type to transfer */
	plantId!: number;

	/** The player slot involved (for deposit: source slot; for withdraw: target slot) */
	playerSlot!: number;
}

@sendablePacket(PacketDirection.NONE)
export class CommandReportPlantTransferRes extends CrowniclesPacket {
	success!: boolean;

	error?: PlantTransferError;

	/** Updated plant storage after transfer */
	plantStorage!: {
		plantId: PlantId;
		quantity: number;
		maxCapacity: number;
	}[];

	/** Updated player plant slots after transfer */
	playerPlantSlots!: {
		slot: number;
		plantId: PlantId | 0;
	}[];
}
