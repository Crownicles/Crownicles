import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import { SexTypeShort } from "../../constants/StringConstants";
import { ExpeditionLocationType } from "../../constants/ExpeditionConstants";

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
}

/**
 * Data sent with the expedition choice menu
 */
export class ReactionCollectorPetExpeditionChoiceData extends ReactionCollectorData {
	petId!: number;

	petSex!: SexTypeShort;

	petNickname?: string;

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
	private readonly petId: number;

	private readonly petSex: SexTypeShort;

	private readonly petNickname: string | undefined;

	private readonly expeditions: ExpeditionOptionData[];

	private readonly hasGuild: boolean;

	private readonly guildFoodAmount: number | undefined;

	constructor(params: {
		petId: number;
		petSex: SexTypeShort;
		petNickname: string | undefined;
		expeditions: ExpeditionOptionData[];
		hasGuild: boolean;
		guildFoodAmount: number | undefined;
	}) {
		super();
		this.petId = params.petId;
		this.petSex = params.petSex;
		this.petNickname = params.petNickname;
		this.expeditions = params.expeditions;
		this.hasGuild = params.hasGuild;
		this.guildFoodAmount = params.guildFoodAmount;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		const reactions = [
			// Add a reaction for each expedition option
			...this.expeditions.map(exp => this.buildReaction(ReactionCollectorPetExpeditionSelectReaction, { expedition: exp })),

			// Add cancel reaction
			this.buildReaction(ReactionCollectorPetExpeditionCancelReaction, {})
		];

		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorPetExpeditionChoiceData, {
				petId: this.petId,
				petSex: this.petSex,
				petNickname: this.petNickname,
				expeditions: this.expeditions,
				hasGuild: this.hasGuild,
				guildFoodAmount: this.guildFoodAmount
			})
		};
	}
}
