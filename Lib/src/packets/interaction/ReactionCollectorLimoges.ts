import {
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorLimogesData extends ReactionCollectorData {
	factKey!: string;

	questionId!: string;
}

export class ReactionCollectorLimoges extends ReactionCollector {
	private readonly factKey: string;

	private readonly questionId: string;

	constructor(factKey: string, questionId: string) {
		super();
		this.factKey = factKey;
		this.questionId = questionId;
	}

	creationPacket(id: string, endTime: number, mainPacket = true): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorLimogesData, {
				factKey: this.factKey,
				questionId: this.questionId
			}),
			mainPacket
		};
	}
}
