import {
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import { ItemWithDetails } from "../../types/ItemWithDetails";

export class ReactionCollectorItemAcceptData extends ReactionCollectorData {
	itemWithDetails!: ItemWithDetails;
}

export class ReactionCollectorItemAcceptDrinkPotionReaction extends ReactionCollectorReaction {}

type ItemAcceptReaction = ReactionCollectorAcceptReaction | ReactionCollectorItemAcceptDrinkPotionReaction | ReactionCollectorRefuseReaction;
export type ReactionCollectorItemAcceptPacket = ReactionCollectorCreationPacket<
	ReactionCollectorItemAcceptData,
	ItemAcceptReaction
>;

export class ReactionCollectorItemAccept extends ReactionCollector {
	private readonly itemWithDetails: ItemWithDetails;

	private readonly canDrink: boolean;

	constructor(itemWithDetails: ItemWithDetails, canDrink: boolean) {
		super();
		this.itemWithDetails = itemWithDetails;
		this.canDrink = canDrink;
	}

	creationPacket(id: string, endTime: number, mainPacket = true): ReactionCollectorItemAcceptPacket {
		const reactions = [this.buildReaction(ReactionCollectorAcceptReaction, {})];

		if (this.canDrink) {
			reactions.push(this.buildReaction(ReactionCollectorItemAcceptDrinkPotionReaction, {}));
		}

		reactions.push(this.buildReaction(ReactionCollectorRefuseReaction, {}));

		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorItemAcceptData, {
				itemWithDetails: this.itemWithDetails
			}),
			mainPacket
		};
	}
}
