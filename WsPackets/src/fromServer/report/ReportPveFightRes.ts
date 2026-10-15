import { FromServerPacket } from "../FromServerPacket";

/** The player hid instead of facing the island boss; it will still be waiting at the next report. */
export class ReportPveFightRefusedRes extends FromServerPacket {
	public static readonly wireName = "ReportPveFightRefusedRes";
}

/** The island had no boss to offer at this stop, so the journey went on without a fight. */
export class ReportPveNoMonsterRes extends FromServerPacket {
	public static readonly wireName = "ReportPveNoMonsterRes";
}
