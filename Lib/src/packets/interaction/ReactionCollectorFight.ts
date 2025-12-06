import {
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import { SexTypeShort } from "../../constants/StringConstants";

type PlayerStats = {
	pet: {
		petTypeId: number;
		petSex: SexTypeShort;
		petNickname: string;
		isOnExpedition: boolean;
	};
	classId: number;
	fightRanking: { glory: number };
	energy: {
		value: number;
		max: number;
	};
	attack: number;
	defense: number;
	speed: number;
	breath: {
		base: number;
		max: number;
		regen: number;
	};
};

export class ReactionCollectorFightData extends ReactionCollectorData {
	playerStats!: PlayerStats;
}

export class ReactionCollectorFight extends ReactionCollector {
	private readonly playerStats: PlayerStats;

	constructor(playerStats: PlayerStats) {
		super();
		this.playerStats = playerStats;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
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
