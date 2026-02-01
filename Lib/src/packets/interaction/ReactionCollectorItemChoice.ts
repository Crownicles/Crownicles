import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import { Item } from "../../types/Item";
import { ItemWithDetails } from "../../types/ItemWithDetails";

export class ReactionCollectorItemChoiceData extends ReactionCollectorData {
	item!: Item;
}

export class ReactionCollectorItemChoiceItemReaction extends ReactionCollectorReaction {
	slot!: number;

	itemWithDetails!: ItemWithDetails;
}

export class ReactionCollectorItemChoiceDrinkPotionReaction extends ReactionCollectorReaction {}

export class ReactionCollectorItemChoiceRefuseReaction extends ReactionCollectorReaction {

}

type ItemChoiceReaction = ReactionCollectorItemChoiceItemReaction | ReactionCollectorItemChoiceDrinkPotionReaction | ReactionCollectorItemChoiceRefuseReaction;
export type ReactionCollectorItemChoicePacket = ReactionCollectorCreationPacket<
	ReactionCollectorItemChoiceData,
	ItemChoiceReaction
>;

export class ReactionCollectorItemChoice extends ReactionCollector {
	private readonly data: ReactionCollectorItemChoiceData;

	private readonly items: ReactionCollectorItemChoiceItemReaction[];

	private readonly canDrink: boolean;

	constructor(data: ReactionCollectorItemChoiceData, items: ReactionCollectorItemChoiceItemReaction[], canDrink: boolean) {
		super();
		this.data = data;
		this.items = items;
		this.canDrink = canDrink;
	}

	creationPacket(id: string, endTime: number, mainPacket = true): ReactionCollectorItemChoicePacket {
		const reactions = [];
		for (const item of this.items) {
			reactions.push(this.buildReaction(ReactionCollectorItemChoiceItemReaction, item));
		}

		if (this.canDrink) {
			reactions.push(this.buildReaction(ReactionCollectorItemChoiceDrinkPotionReaction, {}));
		}

		reactions.push(this.buildReaction(ReactionCollectorItemChoiceRefuseReaction, {}));

		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorItemChoiceData, this.data),
			mainPacket
		};
	}
}
