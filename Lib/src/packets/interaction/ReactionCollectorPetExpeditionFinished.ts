import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import { SexTypeShort } from "../../constants/StringConstants";
import { ExpeditionLocationType } from "../../constants/ExpeditionConstants";

/**
 * Data sent with the finished expedition view (claim rewards menu)
 */
export class ReactionCollectorPetExpeditionFinishedData extends ReactionCollectorData {
	petId!: number;

	petSex!: SexTypeShort;

	petNickname?: string;

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
		petId: number;
		petSex: SexTypeShort;
		petNickname?: string;
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
