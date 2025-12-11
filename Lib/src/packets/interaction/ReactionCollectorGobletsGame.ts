import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";


export abstract class ReactionCollectorGobletsGameReaction extends ReactionCollectorReaction {
	id?: string;
}

export class ReactionCollectorGobletsGameMetalReaction extends ReactionCollectorGobletsGameReaction {
	id? = "metal";
}

export class ReactionCollectorGobletsGameBiggestReaction extends ReactionCollectorGobletsGameReaction {
	id? = "biggest";
}

export class ReactionCollectorGobletsGameSparklingReaction extends ReactionCollectorGobletsGameReaction {
	id? = "sparkling";
}

export class ReactionCollectorGobletsGameData extends ReactionCollectorData {

}

type GobletsGameReaction = ReactionCollectorGobletsGameMetalReaction | ReactionCollectorGobletsGameBiggestReaction | ReactionCollectorGobletsGameSparklingReaction;
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
				this.buildReaction(ReactionCollectorGobletsGameSparklingReaction, {})
			],
			data: this.buildData(ReactionCollectorGobletsGameData, {})
		};
	}
}
