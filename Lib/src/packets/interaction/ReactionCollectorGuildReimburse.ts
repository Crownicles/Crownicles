import {
	AcceptRefusePacket, ReactionCollector, ReactionCollectorAcceptReaction, ReactionCollectorData, ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorGuildReimburseData extends ReactionCollectorData {
	amount!: number;
}

export class ReactionCollectorGuildReimburse extends ReactionCollector {
	constructor(private readonly amount: number) {
		super();
	}

	creationPacket(id: string, endTime: number): AcceptRefusePacket<ReactionCollectorGuildReimburseData> {
		return {
			id,
			endTime,
			data: this.buildData(ReactionCollectorGuildReimburseData, { amount: this.amount }),
			reactions: [this.buildReaction(ReactionCollectorAcceptReaction, {}), this.buildReaction(ReactionCollectorRefuseReaction, {})]
		};
	}
}
