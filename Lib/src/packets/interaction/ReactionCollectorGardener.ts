import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorGardenerData extends ReactionCollectorData {
	seedId!: number;

	cost!: number;

	conditionKey!: string;
}

export type ReactionCollectorGardenerPacket = AcceptRefusePacket<ReactionCollectorGardenerData>;

export class ReactionCollectorGardener extends ReactionCollector {
	private readonly seedId: number;

	private readonly cost: number;

	private readonly conditionKey: string;

	constructor(seedId: number, cost: number, conditionKey: string) {
		super();
		this.seedId = seedId;
		this.cost = cost;
		this.conditionKey = conditionKey;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorGardenerPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorGardenerData, {
				seedId: this.seedId,
				cost: this.cost,
				conditionKey: this.conditionKey
			})
		};
	}
}
