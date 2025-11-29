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
	private readonly petId: number;

	private readonly petSex: SexTypeShort;

	private readonly petNickname: string | undefined;

	private readonly mapLocationId: number;

	private readonly locationType: ExpeditionLocationType;

	private readonly riskRate: number;

	private readonly foodConsumed: number | undefined;

	private readonly isDistantExpedition: boolean | undefined;

	constructor(params: {
		petId: number;
		petSex: SexTypeShort;
		petNickname: string | undefined;
		mapLocationId: number;
		locationType: ExpeditionLocationType;
		riskRate: number;
		foodConsumed: number | undefined;
		isDistantExpedition: boolean | undefined;
	}) {
		super();
		this.petId = params.petId;
		this.petSex = params.petSex;
		this.petNickname = params.petNickname;
		this.mapLocationId = params.mapLocationId;
		this.locationType = params.locationType;
		this.riskRate = params.riskRate;
		this.foodConsumed = params.foodConsumed;
		this.isDistantExpedition = params.isDistantExpedition;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			reactions: [this.buildReaction(ReactionCollectorPetExpeditionClaimReaction, {})],
			data: this.buildData(ReactionCollectorPetExpeditionFinishedData, {
				petId: this.petId,
				petSex: this.petSex,
				petNickname: this.petNickname,
				mapLocationId: this.mapLocationId,
				locationType: this.locationType,
				riskRate: this.riskRate,
				foodConsumed: this.foodConsumed,
				isDistantExpedition: this.isDistantExpedition
			})
		};
	}
}
