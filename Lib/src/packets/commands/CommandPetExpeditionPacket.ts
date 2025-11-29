import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	ExpeditionLocationType, ExpeditionStatus
} from "../../constants/ExpeditionConstants";

/**
 * Data structure representing a single expedition option
 */
export interface ExpeditionData {
	id: string;

	/**
	 * Duration of the expedition in minutes
	 */
	durationMinutes: number;

	/**
	 * Risk rate as a percentage (0-100)
	 */
	riskRate: number;

	/**
	 * Difficulty level (0-100)
	 */
	difficulty: number;

	/**
	 * Wealth rate multiplier (0.0-2.0)
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
}

/**
 * Data for an expedition currently in progress
 */
export interface ExpeditionInProgressData extends ExpeditionData {
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
	petId: number;

	petSex: string;

	petNickname?: string;

	/**
	 * Amount of food consumed for this expedition
	 */
	foodConsumed?: number;
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
	 * Pet nickname for display in error messages
	 */
	petNickname?: string;

	/**
	 * Pet type ID for display
	 */
	petId?: number;

	/**
	 * Pet sex for display
	 */
	petSex?: string;
}

/**
 * Request to generate expedition options
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetExpeditionGeneratePacketReq extends CrowniclesPacket {
}

/**
 * Response with 3 generated expedition options
 */
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetExpeditionGeneratePacketRes extends CrowniclesPacket {
	/**
	 * The 3 expedition options
	 */
	expeditions!: ExpeditionData[];

	/**
	 * Pet information for display
	 */
	petId!: number;

	petSex!: string;

	petNickname?: string;
}

/**
 * Request to start a selected expedition
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetExpeditionChoicePacketReq extends CrowniclesPacket {
	/**
	 * ID of the chosen expedition (from the 3 options)
	 */
	expeditionId!: string;
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
	 * Whether the player had insufficient food (risk multiplied)
	 */
	insufficientFood?: boolean;

	/**
	 * Optional additional info about why food was insufficient.
	 * Possible values: "noGuild" (player has no guild) or "guildNoFood" (guild exists but lacks food).
	 */
	insufficientFoodCause?: "noGuild" | "guildNoFood";
}

/**
 * Request to cancel expedition before departure (after generation)
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetExpeditionCancelPacketReq extends CrowniclesPacket {
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
	 * Pet information for display
	 */
	petId!: number;

	petSex!: string;

	petNickname?: string;
}

/**
 * Request to recall pet during expedition
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetExpeditionRecallPacketReq extends CrowniclesPacket {
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
	petId!: number;

	petSex!: string;

	petNickname?: string;
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

	gems: number;

	experience: number;

	guildExperience: number;

	points: number;

	/**
	 * Whether the clone talisman was found during this expedition
	 */
	cloneTalismanFound?: boolean;
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
	petId!: number;

	petSex!: string;

	petNickname?: string;

	/**
	 * The expedition data for display
	 */
	expedition!: ExpeditionData;
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
