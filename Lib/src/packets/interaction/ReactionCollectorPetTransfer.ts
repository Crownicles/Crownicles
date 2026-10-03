import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData, ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import { OwnedPet } from "../../types/OwnedPet";

export class ReactionCollectorPetTransferData extends ReactionCollectorData {
	ownPet?: OwnedPet;

	shelterPets: {
		petEntityId: number; pet: OwnedPet;
	}[] = [];

	/** Set while the player is on probation: shelter pets are listed, but none can be taken out yet. */
	probationEndsAt?: number;
}

export class ReactionCollectorPetTransferDepositReaction extends ReactionCollectorReaction {}

export class ReactionCollectorPetTransferWithdrawReaction extends ReactionCollectorReaction {
	petEntityId!: number;
}

export class ReactionCollectorPetTransferSwitchReaction extends ReactionCollectorReaction {
	petEntityId!: number;
}

type PetTransferReaction =
	| ReactionCollectorPetTransferDepositReaction
	| ReactionCollectorPetTransferWithdrawReaction
	| ReactionCollectorPetTransferSwitchReaction;
export type ReactionCollectorPetTransferPacket = ReactionCollectorCreationPacket<
	ReactionCollectorPetTransferData,
	PetTransferReaction
>;

export class ReactionCollectorPetTransfer extends ReactionCollector {
	private readonly ownPet: OwnedPet;

	private readonly shelterPets: {
		petEntityId: number; pet: OwnedPet;
	}[];

	private readonly reactions: ReactionCollectorReaction[];

	private readonly probationEndsAt: number | undefined;

	constructor(ownPet: OwnedPet, shelterPets: {
		petEntityId: number; pet: OwnedPet;
	}[], reactions: ReactionCollectorReaction[], probationEndsAt?: number) {
		super();
		this.ownPet = ownPet;
		this.shelterPets = shelterPets;
		this.reactions = reactions;
		this.probationEndsAt = probationEndsAt;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorPetTransferPacket {
		return {
			id,
			endTime,
			reactions: this.reactions.map(reaction => ({
				type: reaction.constructor.name,
				data: reaction
			})),
			data: this.buildData(ReactionCollectorPetTransferData, {
				ownPet: this.ownPet,
				shelterPets: this.shelterPets,
				...this.probationEndsAt === undefined ? {} : { probationEndsAt: this.probationEndsAt }
			})
		};
	}
}
