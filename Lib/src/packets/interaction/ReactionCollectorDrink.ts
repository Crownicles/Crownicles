import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import { ItemWithDetails } from "../../types/ItemWithDetails";

export class ReactionCollectorDrinkData extends ReactionCollectorData {}

export class ReactionCollectorDrinkReaction extends ReactionCollectorReaction {
	potion!: ItemWithDetails;
}

type DrinkReaction = ReactionCollectorDrinkReaction | ReactionCollectorRefuseReaction;
export type ReactionCollectorDrinkPacket = ReactionCollectorCreationPacket<
	ReactionCollectorDrinkData,
	DrinkReaction
>;

export class ReactionCollectorDrink extends ReactionCollector {
	private readonly potions!: ItemWithDetails[];

	constructor(potions: ItemWithDetails[]) {
		super();
		this.potions = potions;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorDrinkPacket {
		return {
			id,
			endTime,
			reactions: [
				...this.potions.map(potion => this.buildReaction(ReactionCollectorDrinkReaction, { potion })),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorDrinkData, {})
		};
	}
}
