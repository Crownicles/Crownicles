import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import {
	PlantId, SeedConditionKey
} from "../../constants/PlantConstants";

export class ReactionCollectorGardenerData extends ReactionCollectorData {
	seedId!: PlantId;

	cost!: number;

	conditionKey!: SeedConditionKey;
}

export type ReactionCollectorGardenerPacket = AcceptRefusePacket<ReactionCollectorGardenerData>;

export class ReactionCollectorGardener extends ReactionCollector {
	private readonly seedId: PlantId;

	private readonly cost: number;

	private readonly conditionKey: SeedConditionKey;

	constructor(seedId: PlantId, cost: number, conditionKey: SeedConditionKey) {
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
