import {
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorLimogesData extends ReactionCollectorData {
	factKey!: string;
}

export class ReactionCollectorLimoges extends ReactionCollector {
	private readonly factKey: string;

	constructor(factKey: string) {
		super();
		this.factKey = factKey;
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
				factKey: this.factKey
			}),
			mainPacket
		};
	}
}
