import {
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorUseTokensData extends ReactionCollectorData {
	cost!: number;

	playerTokens!: number;
}

export class ReactionCollectorUseTokens extends ReactionCollector {
	private readonly cost: number;

	private readonly playerTokens: number;

	constructor(cost: number, playerTokens: number) {
		super();
		this.cost = cost;
		this.playerTokens = playerTokens;
	}

	creationPacket(id: string, endTime: number, mainPacket: boolean): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			mainPacket,
			data: this.buildData(ReactionCollectorUseTokensData, {
				cost: this.cost,
				playerTokens: this.playerTokens
			}),
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			]
		};
	}
}
