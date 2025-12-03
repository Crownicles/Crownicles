import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import { ExpeditionLocationType } from "../../constants/ExpeditionConstants";
import { PetBasicInfo } from "../../types/PetBasicInfo";

/**
 * Data sent with the finished expedition view (claim rewards menu)
 */
export class ReactionCollectorPetExpeditionFinishedData extends ReactionCollectorData {
	pet!: PetBasicInfo;

	mapLocationId!: number;

	locationType!: ExpeditionLocationType;

	riskRate!: number;

	foodConsumed?: number;

	isDistantExpedition?: boolean;
}

/**
 * Reaction to claim the expedition rewards
 */
export class ReactionCollectorPetExpeditionClaimReaction extends ReactionCollectorReaction {
}

/**
 * Collector for the finished expedition view with claim rewards option
 */
export class ReactionCollectorPetExpeditionFinished extends ReactionCollector {
	constructor(private readonly params: {
		pet: PetBasicInfo;
		mapLocationId: number;
		locationType: ExpeditionLocationType;
		riskRate: number;
		foodConsumed?: number;
		isDistantExpedition?: boolean;
	}) {
		super();
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			reactions: [this.buildReaction(ReactionCollectorPetExpeditionClaimReaction, {})],
			data: this.buildData(ReactionCollectorPetExpeditionFinishedData, { ...this.params })
		};
	}
}
