import {
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorUseTokensData extends ReactionCollectorData {
	cost!: number;
}

export class ReactionCollectorUseTokens extends ReactionCollector {
	private readonly cost: number;

	constructor(cost: number) {
		super();
		this.cost = cost;
	}

	creationPacket(id: string, endTime: number, mainPacket: boolean): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			mainPacket,
			data: this.buildData(ReactionCollectorUseTokensData, { cost: this.cost }),
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			]
		};
	}
}
