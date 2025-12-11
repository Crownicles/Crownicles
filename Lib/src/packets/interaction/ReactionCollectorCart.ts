import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

type DisplayedDestination = {
	isDisplayed: boolean;
	id?: number;
	type?: string;
};

export class ReactionCollectorCartData extends ReactionCollectorData {
	displayedDestination!: DisplayedDestination;

	price!: number;
}

export type ReactionCollectorCartPacket = AcceptRefusePacket<ReactionCollectorCartData>;

export class ReactionCollectorCart extends ReactionCollector {
	private readonly displayedDestination: DisplayedDestination;

	private readonly price: number;

	constructor(displayedDestination: DisplayedDestination, price: number) {
		super();
		this.displayedDestination = displayedDestination;
		this.price = price;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCartPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorCartData, {
				displayedDestination: this.displayedDestination,
				price: this.price
			})
		};
	}
}
