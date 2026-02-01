import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData, ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import { Item } from "../../types/Item";

export class ReactionCollectorSellData extends ReactionCollectorData {}

export class ReactionCollectorSellItemReaction extends ReactionCollectorReaction {
	item!: Item;

	slot!: number;

	price!: number;
}

type SellReaction = ReactionCollectorSellItemReaction | ReactionCollectorRefuseReaction;
export type ReactionCollectorSellPacket = ReactionCollectorCreationPacket<
	ReactionCollectorSellData,
	SellReaction
>;

export class ReactionCollectorSell extends ReactionCollector {
	private readonly sellItems: {
		item: Item; slot: number; price: number;
	}[];

	constructor(sellItems: {
		item: Item; slot: number; price: number;
	}[]) {
		super();
		this.sellItems = sellItems;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorSellPacket {
		return {
			id,
			endTime,
			reactions: [
				...this.sellItems.map(sellItem => this.buildReaction(ReactionCollectorSellItemReaction, { ...sellItem })),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorSellData, {})
		};
	}
}
