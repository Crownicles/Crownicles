import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import { ExpeditionLocationType } from "../../constants/ExpeditionConstants";
import { PetBasicInfo } from "../../types/PetBasicInfo";

/**
 * Data for a single expedition option
 */
export interface ExpeditionOptionData {
	id: string;

	mapLocationId: number;

	locationType: ExpeditionLocationType;

	/**
	 * Actual duration in minutes (used for expedition creation)
	 */
	durationMinutes: number;

	/**
	 * Display duration rounded to nearest 10 minutes (shown to player)
	 */
	displayDurationMinutes: number;

	riskRate: number;

	difficulty: number;

	foodCost: number;

	/**
	 * Reward index (0-9) based on duration, risk, and difficulty
	 * Higher value = better potential rewards
	 */
	rewardIndex: number;

	isDistantExpedition?: boolean;

	/**
	 * Whether this expedition has increased clone talisman drop chance
	 */
	hasCloneTalismanBonus?: boolean;

	/**
	 * Whether this expedition has bonus token rewards
	 */
	hasBonusTokens?: boolean;
}

/**
 * Data sent with the expedition choice menu
 */
export class ReactionCollectorPetExpeditionChoiceData extends ReactionCollectorData {
	pet!: PetBasicInfo;

	expeditions!: ExpeditionOptionData[];

	hasGuild!: boolean;

	guildFoodAmount?: number;
}

/**
 * Reaction for selecting an expedition
 */
export class ReactionCollectorPetExpeditionSelectReaction extends ReactionCollectorReaction {
	/**
	 * Complete expedition data (to avoid cache lookup on Core side)
	 */
	expedition!: ExpeditionOptionData;
}

/**
 * Reaction for cancelling expedition selection
 */
export class ReactionCollectorPetExpeditionCancelReaction extends ReactionCollectorReaction {
}

/**
 * Collector for the expedition choice menu
 */
export class ReactionCollectorPetExpeditionChoice extends ReactionCollector {
	constructor(private readonly params: {
		pet: PetBasicInfo;
		expeditions: ExpeditionOptionData[];
		hasGuild: boolean;
		guildFoodAmount?: number;
	}) {
		super();
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		const reactions = [
			// Add a reaction for each expedition option
			...this.params.expeditions.map(exp => this.buildReaction(ReactionCollectorPetExpeditionSelectReaction, { expedition: exp })),

			// Add cancel reaction
			this.buildReaction(ReactionCollectorPetExpeditionCancelReaction, {})
		];

		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorPetExpeditionChoiceData, { ...this.params })
		};
	}
}
