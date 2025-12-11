import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorPveFightData extends ReactionCollectorData {
	monster!: {
		id: string;
		level: number;
		energy: number;
		attack: number;
		defense: number;
		speed: number;
	};

	mapId!: number;
}

export type ReactionCollectorPveFightPacket = AcceptRefusePacket<ReactionCollectorPveFightData>;

export class ReactionCollectorPveFight extends ReactionCollector {
	private readonly data: ReactionCollectorPveFightData;

	constructor(data: ReactionCollectorPveFightData) {
		super();
		this.data = data;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorPveFightPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorPveFightData, this.data)
		};
	}
}
