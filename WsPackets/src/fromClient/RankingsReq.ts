import { FromClientPacket } from "./FromClientPacket";
import {
	TopDataType, TopTiming
} from "../objects/Rankings";

export class FightHistoryReq extends FromClientPacket {
	public static readonly wireName = "FightHistoryReq";
}
export class LeagueRewardReq extends FromClientPacket {
	public static readonly wireName = "LeagueRewardReq";
}
export class LeagueInfoReq extends FromClientPacket {
	public static readonly wireName = "LeagueInfoReq";
}
export class TopReq extends FromClientPacket {
	public static readonly wireName = "TopReq";

	dataType!: TopDataType;

	timing!: TopTiming;

	page?: number;
}
