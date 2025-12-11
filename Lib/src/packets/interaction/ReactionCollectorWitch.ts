import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorWitchReaction extends ReactionCollectorReaction {
	id!: string;
}

export class ReactionCollectorWitchData extends ReactionCollectorData {

}

export type ReactionCollectorWitchPacket = ReactionCollectorCreationPacket<
	ReactionCollectorWitchData,
	ReactionCollectorWitchReaction
>;

export class ReactionCollectorWitch extends ReactionCollector {
	private readonly ingredients: ReactionCollectorWitchReaction[];

	constructor(ingredients: ReactionCollectorWitchReaction[]) {
		super();
		this.ingredients = ingredients;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorWitchPacket {
		const reactions = [];
		for (const ingredient of this.ingredients) {
			reactions.push(this.buildReaction(ReactionCollectorWitchReaction, ingredient));
		}

		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorWitchData, {})
		};
	}
}
