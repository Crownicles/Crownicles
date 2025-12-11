import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorPetFoodInvestigateReaction extends ReactionCollectorReaction {}
export class ReactionCollectorPetFoodSendPetReaction extends ReactionCollectorReaction {}
export class ReactionCollectorPetFoodContinueReaction extends ReactionCollectorReaction {}

export class ReactionCollectorPetFoodSmallEventData extends ReactionCollectorData {
	foodType!: string;
}

type PetFoodSmallEventReaction = ReactionCollectorPetFoodInvestigateReaction | ReactionCollectorPetFoodSendPetReaction | ReactionCollectorPetFoodContinueReaction;
export type ReactionCollectorPetFoodSmallEventPacket = ReactionCollectorCreationPacket<
	ReactionCollectorPetFoodSmallEventData,
	PetFoodSmallEventReaction
>;

export class ReactionCollectorPetFoodSmallEvent extends ReactionCollector {
	private readonly foodType: string;

	constructor(foodType: string) {
		super();
		this.foodType = foodType;
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
				foodType: this.foodType
			})
		};
	}
}
