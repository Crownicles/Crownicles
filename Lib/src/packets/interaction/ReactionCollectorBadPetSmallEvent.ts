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

export class ReactionCollectorBadPetSmallEventData extends ReactionCollectorData {
	// No specific data needed for now, maybe the pet name or something?
	// But the intro text usually handles that on Discord side if we pass it or if it's generic.
}

export class ReactionCollectorBadPetSmallEvent extends ReactionCollector {
	private readonly possibleReactions: ReactionCollectorReaction[];

	constructor(reactions: ReactionCollectorReaction[]) {
		super();
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
			reactions: this.possibleReactions,
			data: this.buildData(ReactionCollectorBadPetSmallEventData, {})
		};
	}
}
