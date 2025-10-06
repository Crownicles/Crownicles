import {
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";


export class ReactionCollectorLimogesData extends ReactionCollectorData {
	questionId!: string;
}

export class ReactionCollectorLimoges extends ReactionCollector {
	private readonly questionId: string;

	constructor(questionId: string) {
		super();
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
				questionId: this.questionId
			}),
			mainPacket
		};
	}
}
