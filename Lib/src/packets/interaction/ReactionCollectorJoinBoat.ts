import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorJoinBoatData extends ReactionCollectorData {
	price!: number;

	energy!: {
		current: number;
		max: number;
	};
}

export type ReactionCollectorJoinBoatPacket = AcceptRefusePacket<ReactionCollectorJoinBoatData>;

export class ReactionCollectorJoinBoat extends ReactionCollector {
	private readonly price: number;

	private readonly currentEnergy: number;

	private readonly maxEnergy: number;

	constructor(price: number, currentEnergy: number, maxEnergy: number) {
		super();
		this.price = price;
		this.currentEnergy = currentEnergy;
		this.maxEnergy = maxEnergy;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorJoinBoatPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorJoinBoatData, {
				price: this.price,
				energy: {
					current: this.currentEnergy,
					max: this.maxEnergy
				}
			})
		};
	}
}
