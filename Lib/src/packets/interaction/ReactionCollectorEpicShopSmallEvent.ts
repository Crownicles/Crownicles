import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import { ReactionCollectorAnyShopSmallEventData } from "./ReactionCollectorAnyShopSmallEvent";

export class ReactionCollectorEpicShopSmallEventData extends ReactionCollectorAnyShopSmallEventData {
	tip!: boolean;
}

export type ReactionCollectorEpicShopSmallEventPacket = AcceptRefusePacket<ReactionCollectorEpicShopSmallEventData>;

export class ReactionCollectorEpicShopSmallEvent extends ReactionCollector {
	private readonly data: ReactionCollectorEpicShopSmallEventData;

	constructor(data: ReactionCollectorEpicShopSmallEventData) {
		super();
		this.data = data;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorEpicShopSmallEventPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorEpicShopSmallEventData, this.data)
		};
	}
}
