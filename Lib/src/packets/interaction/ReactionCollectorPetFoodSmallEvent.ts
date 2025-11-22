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

export class ReactionCollectorPetFoodSmallEvent extends ReactionCollector {
	private readonly foodType: string;

	constructor(foodType: string) {
		super();
		this.foodType = foodType;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
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
