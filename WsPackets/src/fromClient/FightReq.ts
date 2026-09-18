import { FromClientPacket } from "./FromClientPacket";

export class FightReq extends FromClientPacket {
	public static readonly wireName = "FightReq";
}

export class FightResumeReq extends FromClientPacket {
	public static readonly wireName = "FightResumeReq";
}
