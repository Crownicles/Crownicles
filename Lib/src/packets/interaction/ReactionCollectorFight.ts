import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import type { FightPlayerStats } from "../../types/FightPlayerStats";

export class ReactionCollectorFightData extends ReactionCollectorData {
	playerStats!: FightPlayerStats;
}

export type ReactionCollectorFightPacket = AcceptRefusePacket<ReactionCollectorFightData>;

export class ReactionCollectorFight extends ReactionCollector {
	private readonly playerStats: FightPlayerStats;

	constructor(playerStats: FightPlayerStats) {
		super();
		this.playerStats = playerStats;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorFightPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorFightData, { playerStats: this.playerStats })
		};
	}
}
