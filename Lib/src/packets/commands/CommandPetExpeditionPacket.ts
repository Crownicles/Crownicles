import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	ExpeditionLocationType, ExpeditionStatus
} from "../../constants/ExpeditionConstants";
import { PetFood } from "../../constants/PetConstants";
import { PetBasicInfo } from "../../types/PetBasicInfo";

/**
 * Reason why food was insufficient for expedition
 */
export type InsufficientFoodCause = "noGuild" | "guildNoFood";

/**
 * Detail of food consumed for an expedition
 */
export interface FoodConsumptionDetail {
	foodType: PetFood;
	amount: number;
}

/**
 * Data structure representing a single expedition option (server-side with all data)
 */
export interface ExpeditionData {
	id: string;

	/**
	 * Duration of the expedition in minutes
	 */
	durationMinutes: number;

	/**
	 * Duration rounded up to the nearest 10 minutes for display in selection menu
	 */
	displayDurationMinutes: number;

	/**
	 * Risk rate as a percentage (0-100)
	 */
	riskRate: number;

	/**
	 * Difficulty level (0-100)
	 */
	difficulty: number;

	/**
	 * Wealth rate multiplier (0.0-2.0) - SERVER ONLY, not sent to client
	 */
	wealthRate: number;

	/**
	 * Location type affecting reward weights
	 */
	locationType: ExpeditionLocationType;

	/**
	 * Food cost for this expedition (based on reward index)
	 */
	foodCost?: number;

	/**
	 * ID of the map location for local expeditions (linked to player's current position)
	 */
	mapLocationId?: number;

	/**
	 * Whether this is a distant expedition (3rd option, can be anywhere on the map)
	 */
	isDistantExpedition?: boolean;

	/**
	 * Whether this expedition has increased clone talisman drop chance
	 * Only appears when player doesn't have the clone talisman (1/20 chance per expedition)
	 */
	hasCloneTalismanBonus?: boolean;

	/**
	 * Whether this expedition has bonus token rewards (1 in 50 expeditions, mutually exclusive with clone talisman bonus)
	 */
	hasBonusTokens?: boolean;
}

/**
 * Base client data for expeditions (without server-only fields like wealthRate)
 */
export interface ExpeditionClientData {
	id: string;
	durationMinutes: number;
	displayDurationMinutes: number;
	riskRate: number;
	difficulty: number;
	locationType: ExpeditionLocationType;
	foodCost?: number;
	mapLocationId?: number;
	isDistantExpedition?: boolean;
}

/**
 * Data for an expedition currently in progress (client-side version)
 */
export interface ExpeditionInProgressData extends ExpeditionClientData {
	startTime: number;

	/**
	 * Timestamp when the expedition will end
	 */
	endTime: number;

	/**
	 * Current status of the expedition
	 */
	status: ExpeditionStatus;

	/**
	 * Pet information
	 */
	pet: PetBasicInfo;

	/**
	 * Amount of food consumed for this expedition
	 */
	foodConsumed?: number;

	/**
	 * Detailed breakdown of food consumed by type
	 */
	foodConsumedDetails?: FoodConsumptionDetail[];
}

/**
 * Request to open the expedition interface
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetExpeditionPacketReq extends CrowniclesPacket {
}

/**
 * Response with expedition status and options
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetExpeditionPacketRes extends CrowniclesPacket {
	/**
	 * Whether the player has the talisman
	 */
	hasTalisman!: boolean;

	/**
	 * Whether an expedition is already in progress
	 */
	hasExpeditionInProgress!: boolean;

	/**
	 * Data for the expedition in progress (if any)
	 */
	expeditionInProgress?: ExpeditionInProgressData;

	/**
	 * Whether the player meets requirements to start an expedition
	 */
	canStartExpedition!: boolean;

	/**
	 * Reason why the player cannot start an expedition (if applicable)
	 */
	cannotStartReason?: string;

	/**
	 * Current love points of the pet
	 */
	petLovePoints?: number;

	/**
	 * Pet info for display in error messages
	 */
	pet?: PetBasicInfo;
}

/**
 * Response after starting an expedition
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetExpeditionChoicePacketRes extends CrowniclesPacket {
	/**
	 * Whether the expedition was successfully started
	 */
	success!: boolean;

	/**
	 * Reason for failure (if applicable)
	 */
	failureReason?: string;

	/**
	 * The expedition that was started (if successful)
	 */
	expedition?: ExpeditionInProgressData;

	/**
	 * Amount of food consumed
	 */
	foodConsumed?: number;

	/**
	 * Detailed breakdown of food consumed by type
	 */
	foodConsumedDetails?: FoodConsumptionDetail[];

	/**
	 * Whether the player had insufficient food (risk multiplied)
	 */
	insufficientFood?: boolean;

	/**
	 * Optional additional info about why food was insufficient.
	 * Possible values: "noGuild" (player has no guild) or "guildNoFood" (guild exists but lacks food).
	 */
	insufficientFoodCause?: InsufficientFoodCause;

	/**
	 * Duration modifier based on pet speed (0.70 to 1.20)
	 * Values below 1.0 mean faster expedition, above 1.0 mean slower
	 */
	speedDurationModifier?: number;

	/**
	 * Original display duration shown in the expedition selection menu (before speed modifier)
	 * Used to calculate the speed category message (fast/slow) correctly
	 */
	originalDisplayDurationMinutes?: number;
}

/**
 * Response after cancelling expedition
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetExpeditionCancelPacketRes extends CrowniclesPacket {
	/**
	 * Love points lost due to cancellation
	 */
	loveLost!: number;

	/**
	 * Whether this was the first (free) cancellation of the week
	 */
	isFreeCancellation!: boolean;

	/**
	 * Pet information for display
	 */
	pet!: PetBasicInfo;
}

/**
 * Response after recalling pet
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetExpeditionRecallPacketRes extends CrowniclesPacket {
	/**
	 * Love points lost due to recall
	 */
	loveLost!: number;

	/**
	 * Pet information for display
	 */
	pet!: PetBasicInfo;
}

/**
 * Request to check and resolve a completed expedition
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetExpeditionResolvePacketReq extends CrowniclesPacket {
}

/**
 * Reward data for a completed expedition
 */
export interface ExpeditionRewardData {
	money: number;

	experience: number;

	points: number;

	/**
	 * Tokens earned during the expedition
	 */
	tokens?: number;

	/**
	 * Whether the clone talisman was found during this expedition
	 */
	cloneTalismanFound?: boolean;

	/**
	 * Whether an item was given during this expedition
	 */
	itemGiven?: boolean;
}

/**
 * Response after resolving a completed expedition
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetExpeditionResolvePacketRes extends CrowniclesPacket {
	/**
	 * Whether the expedition was successful
	 */
	success!: boolean;

	/**
	 * Whether it was a partial success (half rewards)
	 */
	partialSuccess!: boolean;

	/**
	 * Total failure (no rewards)
	 */
	totalFailure!: boolean;

	/**
	 * Rewards earned (after multipliers and partial success adjustments)
	 */
	rewards?: ExpeditionRewardData;

	/**
	 * Love points change (positive for success, negative for failure)
	 */
	loveChange!: number;

	/**
	 * Pet information for display
	 */
	pet!: PetBasicInfo;

	/**
	 * The expedition data for display
	 */
	expedition!: ExpeditionData;

	/**
	 * Badge earned during this expedition (e.g., expert expediteur)
	 */
	badgeEarned?: string;

	/**
	 * True if the pet liked this expedition type (for special message)
	 */
	petLikedExpedition!: boolean;
}

/**
 * Error packet for expedition-related errors
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetExpeditionErrorPacket extends CrowniclesPacket {
	/**
	 * Error code for translation
	 */
	errorCode!: string;
}
