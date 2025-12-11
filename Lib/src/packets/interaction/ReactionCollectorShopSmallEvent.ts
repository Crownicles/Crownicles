import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import { ReactionCollectorAnyShopSmallEventData } from "./ReactionCollectorAnyShopSmallEvent";

export class ReactionCollectorShopSmallEventData extends ReactionCollectorAnyShopSmallEventData {
}

export type ReactionCollectorShopSmallEventPacket = AcceptRefusePacket<ReactionCollectorShopSmallEventData>;

export class ReactionCollectorShopSmallEvent extends ReactionCollector {
	private readonly data: ReactionCollectorShopSmallEventData;

	constructor(data: ReactionCollectorShopSmallEventData) {
		super();
		this.data = data;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorShopSmallEventPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorShopSmallEventData, this.data)
		};
	}
}
