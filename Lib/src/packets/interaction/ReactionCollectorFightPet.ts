import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorFightPetReaction extends ReactionCollectorReaction {
	actionId!: string;
}

export class ReactionCollectorFightPetData extends ReactionCollectorData {
	petId!: number;

	isFemale!: boolean;
}

export type ReactionCollectorFightPetPacket = ReactionCollectorCreationPacket<
	ReactionCollectorFightPetData,
	ReactionCollectorFightPetReaction
>;

export class ReactionCollectorFightPet extends ReactionCollector {
	private readonly actions: ReactionCollectorFightPetReaction[];

	private readonly petId: number;

	private readonly isFemale: boolean;

	constructor(petId: number, isFemale: boolean, actions: ReactionCollectorFightPetReaction[]) {
		super();
		this.petId = petId;
		this.isFemale = isFemale;
		this.actions = actions;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorFightPetPacket {
		const reactions = [];
		for (const action of this.actions) {
			reactions.push(this.buildReaction(ReactionCollectorFightPetReaction, action));
		}

		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorFightPetData, {
				petId: this.petId, isFemale: this.isFemale
			})
		};
	}
}
