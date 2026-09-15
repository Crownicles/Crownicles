import { FromServerPacket } from "../FromServerPacket";
import {
	FightHistoryEntry, LeagueRewardOutcome, RankingEntry, TopDataType, TopTiming, LeagueInfo
} from "../../objects/Rankings";

export class FightHistoryRes extends FromServerPacket {
	public static readonly wireName = "FightHistoryRes";

	history!: FightHistoryEntry[];
}
export class LeagueRewardRes extends FromServerPacket {
	public static readonly wireName = "LeagueRewardRes";

	outcome!: LeagueRewardOutcome;
}
export class LeagueInfoRes extends FromServerPacket {
	public static readonly wireName = "LeagueInfoRes";

	leagues!: LeagueInfo[];

	currentLeagueId!: number;

	glory!: number;
}
export class TopRes extends FromServerPacket {
	public static readonly wireName = "TopRes";

	dataType!: TopDataType;

	timing!: TopTiming;

	contextRank?: number;

	canBeRanked!: boolean;

	elements!: RankingEntry[];

	totalElements!: number;

	elementsPerPage!: number;

	pageNumber!: number;

	needFight?: number;
}
export class TopEmptyRes extends FromServerPacket {
	public static readonly wireName = "TopEmptyRes";

	needFight?: number;
}
