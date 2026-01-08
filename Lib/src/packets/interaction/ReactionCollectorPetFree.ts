import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import { SexTypeShort } from "../../constants/StringConstants";
import { OwnedPet } from "../../types/OwnedPet";

export class ReactionCollectorPetFreeData extends ReactionCollectorData {
	petId!: number;

	petSex!: SexTypeShort;

	petNickname?: string;

	freeCost!: number;
}

export type ReactionCollectorPetFreePacket = AcceptRefusePacket<ReactionCollectorPetFreeData>;

export class ReactionCollectorPetFree extends ReactionCollector {
	private readonly petId: number;

	private readonly petSex: SexTypeShort;

	private readonly petNickname: string | undefined;

	private readonly freeCost: number;

	constructor(petId: number, petSex: SexTypeShort, petNickname: string | undefined, freeCost: number) {
		super();
		this.petId = petId;
		this.petSex = petSex;
		this.petNickname = petNickname;
		this.freeCost = freeCost;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorPetFreePacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorPetFreeData, {
				petId: this.petId,
				petSex: this.petSex,
				petNickname: this.petNickname,
				freeCost: this.freeCost
			})
		};
	}
}

// Reaction to select a shelter pet to free
export class ReactionCollectorPetFreeSelectReaction extends ReactionCollectorReaction {
	petEntityId!: number;
}

// Data for shelter pet selection collector
export class ReactionCollectorPetFreeSelectionData extends ReactionCollectorData {
	ownPet?: OwnedPet;

	shelterPets: {
		petEntityId: number;
		pet: OwnedPet;
	}[] = [];
}

type PetFreeSelectionReaction = ReactionCollectorPetFreeSelectReaction | ReactionCollectorRefuseReaction;

export type ReactionCollectorPetFreeSelectionPacket = ReactionCollectorCreationPacket<
	ReactionCollectorPetFreeSelectionData,
	PetFreeSelectionReaction
>;

export class ReactionCollectorPetFreeSelection extends ReactionCollector {
	private readonly ownPet: OwnedPet | undefined;

	private readonly shelterPets: {
		petEntityId: number;
		pet: OwnedPet;
	}[];

	private readonly reactions: ReactionCollectorReaction[];

	constructor(
		ownPet: OwnedPet | undefined,
		shelterPets: {
			petEntityId: number;
			pet: OwnedPet;
		}[],
		reactions: ReactionCollectorReaction[]
	) {
		super();
		this.ownPet = ownPet;
		this.shelterPets = shelterPets;
		this.reactions = reactions;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorPetFreeSelectionPacket {
		return {
			id,
			endTime,
			reactions: this.reactions.map(reaction => ({
				type: reaction.constructor.name,
				data: reaction
			})),
			data: this.buildData(ReactionCollectorPetFreeSelectionData, {
				ownPet: this.ownPet,
				shelterPets: this.shelterPets
			})
		};
	}
}
