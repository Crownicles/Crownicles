import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { ItemCategory } from "../../constants/ItemConstants";
import { ItemWithDetails } from "../../types/ItemWithDetails";
import { ChestSlotsPerCategory } from "../../types/HomeFeatures";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandReportPacketReq extends CrowniclesPacket {
}

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
	action!: string;

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

	/** Error type if failed: "chestFull", "inventoryFull", "invalid" */
	error?: string;

	/** Refreshed chest items list */
	chestItems!: {
		slot: number;
		category: ItemCategory;
		details: ItemWithDetails;
	}[];

	/** Refreshed depositable items from inventory */
	depositableItems!: {
		slot: number;
		category: ItemCategory;
		details: ItemWithDetails;
	}[];

	/** Slots per category (unchanged but included for completeness) */
	slotsPerCategory!: ChestSlotsPerCategory;

	/** Max backup slots per category in the player's inventory */
	inventoryCapacity!: ChestSlotsPerCategory;
}

