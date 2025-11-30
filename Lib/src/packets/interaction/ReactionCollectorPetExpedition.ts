import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import { SexTypeShort } from "../../constants/StringConstants";
import { ExpeditionLocationType } from "../../constants/ExpeditionConstants";
import { FoodConsumptionDetail } from "../commands/CommandPetExpeditionPacket";

/**
 * Data sent with the expedition in progress view (recall menu)
 */
export class ReactionCollectorPetExpeditionData extends ReactionCollectorData {
	petId!: number;

	petSex!: SexTypeShort;

	petNickname?: string;

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
	private readonly petId: number;

	private readonly petSex: SexTypeShort;

	private readonly petNickname: string | undefined;

	private readonly mapLocationId: number;

	private readonly locationType: ExpeditionLocationType;

	private readonly riskRate: number;

	private readonly returnTime: number;

	private readonly foodConsumed: number | undefined;

	private readonly foodConsumedDetails: FoodConsumptionDetail[] | undefined;

	private readonly isDistantExpedition: boolean | undefined;

	constructor(params: {
		petId: number;
		petSex: SexTypeShort;
		petNickname: string | undefined;
		mapLocationId: number;
		locationType: ExpeditionLocationType;
		riskRate: number;
		returnTime: number;
		foodConsumed: number | undefined;
		foodConsumedDetails: FoodConsumptionDetail[] | undefined;
		isDistantExpedition: boolean | undefined;
	}) {
		super();
		this.petId = params.petId;
		this.petSex = params.petSex;
		this.petNickname = params.petNickname;
		this.mapLocationId = params.mapLocationId;
		this.locationType = params.locationType;
		this.riskRate = params.riskRate;
		this.returnTime = params.returnTime;
		this.foodConsumed = params.foodConsumed;
		this.foodConsumedDetails = params.foodConsumedDetails;
		this.isDistantExpedition = params.isDistantExpedition;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorPetExpeditionRecallReaction, {}),
				this.buildReaction(ReactionCollectorPetExpeditionCloseReaction, {})
			],
			data: this.buildData(ReactionCollectorPetExpeditionData, {
				petId: this.petId,
				petSex: this.petSex,
				petNickname: this.petNickname,
				mapLocationId: this.mapLocationId,
				locationType: this.locationType,
				riskRate: this.riskRate,
				returnTime: this.returnTime,
				foodConsumed: this.foodConsumed,
				foodConsumedDetails: this.foodConsumedDetails,
				isDistantExpedition: this.isDistantExpedition
			})
		};
	}
}
