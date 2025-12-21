import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import { SexTypeShort } from "../../constants/StringConstants";

export class ReactionCollectorPetFoodInvestigateReaction extends ReactionCollectorReaction {}
export class ReactionCollectorPetFoodSendPetReaction extends ReactionCollectorReaction {}
export class ReactionCollectorPetFoodContinueReaction extends ReactionCollectorReaction {}

export class ReactionCollectorPetFoodSmallEventData extends ReactionCollectorData {
	foodType!: string;

	petSex!: SexTypeShort;
}

type PetFoodSmallEventReaction = ReactionCollectorPetFoodInvestigateReaction | ReactionCollectorPetFoodSendPetReaction | ReactionCollectorPetFoodContinueReaction;
export type ReactionCollectorPetFoodSmallEventPacket = ReactionCollectorCreationPacket<
	ReactionCollectorPetFoodSmallEventData,
	PetFoodSmallEventReaction
>;

export class ReactionCollectorPetFoodSmallEvent extends ReactionCollector {
	private readonly foodType: string;

	private readonly petSex: SexTypeShort;

	constructor(foodType: string, petSex: SexTypeShort) {
		super();
		this.foodType = foodType;
		this.petSex = petSex;
	}

	/**
	 * Create the packet data for the pet food reaction collector
	 * @param id - Collector identifier
	 * @param endTime - Timestamp when the collector expires
	 * @returns The reaction collector creation packet
	 */
	creationPacket(id: string, endTime: number): ReactionCollectorPetFoodSmallEventPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorPetFoodInvestigateReaction, {}),
				this.buildReaction(ReactionCollectorPetFoodSendPetReaction, {}),
				this.buildReaction(ReactionCollectorPetFoodContinueReaction, {})
			],
			data: this.buildData(ReactionCollectorPetFoodSmallEventData, {
				foodType: this.foodType,
				petSex: this.petSex
			})
		};
	}
}
