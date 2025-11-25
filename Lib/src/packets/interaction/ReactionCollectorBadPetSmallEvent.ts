import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorBadPetIntimidateReaction extends ReactionCollectorReaction {}
export class ReactionCollectorBadPetPleadReaction extends ReactionCollectorReaction {}
export class ReactionCollectorBadPetGiveMeatReaction extends ReactionCollectorReaction {}
export class ReactionCollectorBadPetGiveVegReaction extends ReactionCollectorReaction {}
export class ReactionCollectorBadPetFleeReaction extends ReactionCollectorReaction {}
export class ReactionCollectorBadPetHideReaction extends ReactionCollectorReaction {}
export class ReactionCollectorBadPetWaitReaction extends ReactionCollectorReaction {}
export class ReactionCollectorBadPetProtectReaction extends ReactionCollectorReaction {}
export class ReactionCollectorBadPetDistractReaction extends ReactionCollectorReaction {}
export class ReactionCollectorBadPetCalmReaction extends ReactionCollectorReaction {}
export class ReactionCollectorBadPetImposerReaction extends ReactionCollectorReaction {}
export class ReactionCollectorBadPetEnergizeReaction extends ReactionCollectorReaction {}

export class ReactionCollectorBadPetSmallEventData extends ReactionCollectorData {
	petId!: number;

	sex!: string;

	petNickname?: string;
}

export class ReactionCollectorBadPetSmallEvent extends ReactionCollector {
	/**
	 * For alignment with the witch small event, bad-pet reactions now carry an ID in their data (eg 'intimidate').
	 * This class accepts an array of ReactionCollectorReaction instances (each must include the id field)
	 * and uses them directly when building the creation packet.
	 */
	private readonly possibleReactions: ReactionCollectorReaction[];

	private readonly petId: number;

	private readonly sex: string;

	private readonly petNickname: string | undefined;

	constructor(petId: number, sex: string, petNickname: string | undefined, reactions: ReactionCollectorReaction[]) {
		super();
		this.petId = petId;
		this.sex = sex;
		this.petNickname = petNickname;
		this.possibleReactions = reactions;
	}

	/**
	 * Create the packet data for the bad pet reaction collector
	 * @param id - Collector identifier
	 * @param endTime - Timestamp when the collector expires
	 * @returns The reaction collector creation packet
	 */
	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			reactions: this.possibleReactions.map(r => this.buildReaction(r.constructor as any, r as any)),
			data: this.buildData(ReactionCollectorBadPetSmallEventData, {
				petId: this.petId,
				sex: this.sex,
				petNickname: this.petNickname
			})
		};
	}
}
