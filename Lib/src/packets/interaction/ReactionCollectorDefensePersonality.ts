import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import type { AiPersonality } from "../../constants/AiPersonalityConstants";

export class ReactionCollectorDefensePersonalityData extends ReactionCollectorData {
	classId!: number;

	/**
	 * Personality currently defending the player, missing when a random one is picked at each fight
	 */
	currentPersonality?: AiPersonality;
}

/**
 * Choice of a defense personality, a missing personality means a random one at each fight
 */
export class ReactionCollectorDefensePersonalityReaction extends ReactionCollectorReaction {
	personality?: AiPersonality;
}

type DefensePersonalityReaction = ReactionCollectorDefensePersonalityReaction | ReactionCollectorRefuseReaction;
export type ReactionCollectorDefensePersonalityPacket = ReactionCollectorCreationPacket<ReactionCollectorDefensePersonalityData, DefensePersonalityReaction>;

export class ReactionCollectorDefensePersonality extends ReactionCollector {
	private readonly classId: number;

	private readonly personalities: AiPersonality[];

	private readonly currentPersonality?: AiPersonality;

	constructor(classId: number, personalities: AiPersonality[], currentPersonality?: AiPersonality) {
		super();
		this.classId = classId;
		this.personalities = personalities;
		this.currentPersonality = currentPersonality;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorDefensePersonalityPacket {
		return {
			id,
			endTime,
			reactions: [
				...this.personalities.map(personality => this.buildReaction(ReactionCollectorDefensePersonalityReaction, { personality })),
				this.buildReaction(ReactionCollectorDefensePersonalityReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorDefensePersonalityData, {
				classId: this.classId,
				...this.currentPersonality ? { currentPersonality: this.currentPersonality } : {}
			})
		};
	}
}
