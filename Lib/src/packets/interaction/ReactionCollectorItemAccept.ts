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

	foundItem!: ItemWithDetails;
}

export class ReactionCollectorItemAcceptDrinkPotionReaction extends ReactionCollectorReaction {}

type ItemAcceptReaction = ReactionCollectorAcceptReaction | ReactionCollectorItemAcceptDrinkPotionReaction | ReactionCollectorRefuseReaction;
export type ReactionCollectorItemAcceptPacket = ReactionCollectorCreationPacket<
	ReactionCollectorItemAcceptData,
	ItemAcceptReaction
>;

export class ReactionCollectorItemAccept extends ReactionCollector {
	private readonly data: ReactionCollectorItemAcceptData;

	private readonly canDrink: boolean;

	constructor(data: ReactionCollectorItemAcceptData, canDrink: boolean) {
		super();
		this.data = data;
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
			data: this.buildData(ReactionCollectorItemAcceptData, this.data),
			mainPacket
		};
	}
}
