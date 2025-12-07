import {
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorBuyHealData extends ReactionCollectorData {
	healPrice!: number;
}

export class ReactionCollectorBuyHeal extends ReactionCollector {
	private readonly healPrice: number;

	constructor(healPrice: number) {
		super();
		this.healPrice = healPrice;
	}

	creationPacket(id: string, endTime: number, mainPacket: boolean): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			mainPacket,
			data: this.buildData(ReactionCollectorBuyHealData, { healPrice: this.healPrice }),
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			]
		};
	}
}
