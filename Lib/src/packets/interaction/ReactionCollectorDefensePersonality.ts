import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import type { AiPersonality } from "../../constants/AiPersonalityConstants";
import type { DefenseRecordByAttackerClass } from "../../types/DefenseRecord";

export class ReactionCollectorDefensePersonalityData extends ReactionCollectorData {
	classId!: number;

	/**
	 * Personality currently defending the player, missing when a random one is picked at each fight
	 */
	currentPersonality?: AiPersonality;

	/**
	 * Recent defenses of the player by class of the attackers, the most frequent attackers first
	 */
	recentDefenses!: DefenseRecordByAttackerClass[];
}

/**
 * What the player is offered when choosing the personality defending them
 */
export type DefensePersonalityChoice = {
	classId: number;
	personalities: AiPersonality[];
	currentPersonality?: AiPersonality;
	recentDefenses: DefenseRecordByAttackerClass[];
};

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

	private readonly recentDefenses: DefenseRecordByAttackerClass[];

	constructor(choice: DefensePersonalityChoice) {
		super();
		this.classId = choice.classId;
		this.personalities = choice.personalities;
		this.currentPersonality = choice.currentPersonality;
		this.recentDefenses = choice.recentDefenses;
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
				recentDefenses: this.recentDefenses,
				...this.currentPersonality ? { currentPersonality: this.currentPersonality } : {}
			})
		};
	}
}
