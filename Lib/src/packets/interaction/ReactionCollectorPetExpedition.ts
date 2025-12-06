import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import { ExpeditionLocationType } from "../../constants/ExpeditionConstants";
import { FoodConsumptionDetail } from "../commands/CommandPetExpeditionPacket";
import { PetBasicInfo } from "../../types/PetBasicInfo";

/**
 * Data sent with the expedition in progress view (recall menu)
 */
export class ReactionCollectorPetExpeditionData extends ReactionCollectorData {
	pet!: PetBasicInfo;

	mapLocationId!: number;

	locationType!: ExpeditionLocationType;

	riskRate!: number;

	returnTime!: number;

	foodConsumed?: number;

	foodConsumedDetails?: FoodConsumptionDetail[];

	isDistantExpedition?: boolean;
}

/**
 * Reaction to recall the pet
 */
export class ReactionCollectorPetExpeditionRecallReaction extends ReactionCollectorReaction {
}

/**
 * Reaction to close the view without recalling
 */
export class ReactionCollectorPetExpeditionCloseReaction extends ReactionCollectorReaction {
}

/**
 * Collector for the expedition in progress view with recall option
 */
export class ReactionCollectorPetExpedition extends ReactionCollector {
	constructor(private readonly params: {
		pet: PetBasicInfo;
		mapLocationId: number;
		locationType: ExpeditionLocationType;
		riskRate: number;
		returnTime: number;
		foodConsumed?: number;
		foodConsumedDetails?: FoodConsumptionDetail[];
		isDistantExpedition?: boolean;
	}) {
		super();
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorPetExpeditionRecallReaction, {}),
				this.buildReaction(ReactionCollectorPetExpeditionCloseReaction, {})
			],
			data: this.buildData(ReactionCollectorPetExpeditionData, { ...this.params })
		};
	}
}
