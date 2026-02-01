import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";
import { SmallEventGobletsGameStrategy } from "../smallEvents/SmallEventGobletsGamePacket";


export abstract class ReactionCollectorGobletsGameReaction extends ReactionCollectorReaction {
	id?: string;

	strategy?: SmallEventGobletsGameStrategy;
}

/**
 * Metal goblet - Classic strategy
 */
export class ReactionCollectorGobletsGameMetalReaction extends ReactionCollectorGobletsGameReaction {
	id? = "metal";

	strategy? = SmallEventGobletsGameStrategy.CLASSIC;
}

/**
 * Biggest goblet - Safe strategy
 */
export class ReactionCollectorGobletsGameBiggestReaction extends ReactionCollectorGobletsGameReaction {
	id? = "biggest";

	strategy? = SmallEventGobletsGameStrategy.SAFE;
}

/**
 * Sparkling goblet - Risky strategy
 */
export class ReactionCollectorGobletsGameSparklingReaction extends ReactionCollectorGobletsGameReaction {
	id? = "sparkling";

	strategy? = SmallEventGobletsGameStrategy.RISKY;
}

/**
 * Cracked goblet - Gambler strategy
 */
export class ReactionCollectorGobletsGameCrackedReaction extends ReactionCollectorGobletsGameReaction {
	id? = "cracked";

	strategy? = SmallEventGobletsGameStrategy.GAMBLER;
}

export class ReactionCollectorGobletsGameData extends ReactionCollectorData {

}

type GobletsGameReaction =
	| ReactionCollectorGobletsGameMetalReaction
	| ReactionCollectorGobletsGameBiggestReaction
	| ReactionCollectorGobletsGameSparklingReaction
	| ReactionCollectorGobletsGameCrackedReaction;

export type ReactionCollectorGobletsGamePacket = ReactionCollectorCreationPacket<
	ReactionCollectorGobletsGameData,
	GobletsGameReaction
>;

export class ReactionCollectorGobletsGame extends ReactionCollector {
	creationPacket(id: string, endTime: number): ReactionCollectorGobletsGamePacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorGobletsGameMetalReaction, {}),
				this.buildReaction(ReactionCollectorGobletsGameBiggestReaction, {}),
				this.buildReaction(ReactionCollectorGobletsGameSparklingReaction, {}),
				this.buildReaction(ReactionCollectorGobletsGameCrackedReaction, {})
			],
			data: this.buildData(ReactionCollectorGobletsGameData, {})
		};
	}
}
