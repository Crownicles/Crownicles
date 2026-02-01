import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";

/**
 * Single reaction class for all bad pet actions, identified by an id field.
 * Following the same pattern as ReactionCollectorWitchReaction.
 */
export class ReactionCollectorBadPetReaction extends ReactionCollectorReaction {
	id!: string;
}

export class ReactionCollectorBadPetSmallEventData extends ReactionCollectorData {
	petId!: number;

	sex!: string;

	petNickname?: string;
}

export type ReactionCollectorBadPetSmallEventPacket = ReactionCollectorCreationPacket<
	ReactionCollectorBadPetSmallEventData,
	ReactionCollectorBadPetReaction
>;

export class ReactionCollectorBadPetSmallEvent extends ReactionCollector {
	private readonly reactions: ReactionCollectorBadPetReaction[];

	private readonly petId: number;

	private readonly sex: string;

	private readonly petNickname: string | undefined;

	constructor(petId: number, sex: string, petNickname: string | undefined, reactions: ReactionCollectorBadPetReaction[]) {
		super();
		this.petId = petId;
		this.sex = sex;
		this.petNickname = petNickname;
		this.reactions = reactions;
	}

	/**
	 * Create the packet data for the bad pet reaction collector
	 * @param id - Collector identifier
	 * @param endTime - Timestamp when the collector expires
	 * @returns The reaction collector creation packet
	 */
	creationPacket(id: string, endTime: number): ReactionCollectorBadPetSmallEventPacket {
		return {
			id,
			endTime,
			reactions: this.reactions.map(reaction => this.buildReaction(ReactionCollectorBadPetReaction, reaction)),
			data: this.buildData(ReactionCollectorBadPetSmallEventData, {
				petId: this.petId,
				sex: this.sex,
				petNickname: this.petNickname
			})
		};
	}
}
