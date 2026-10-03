import { FromClientPacket } from "./FromClientPacket";

export class RespawnReq extends FromClientPacket {
	public static readonly wireName = "RespawnReq";
}
export class UnlockReq extends FromClientPacket {
	public static readonly wireName = "UnlockReq";

	rank!: number;
}
export class JoinBoatReq extends FromClientPacket {
	public static readonly wireName = "JoinBoatReq";
}
export class VersionReq extends FromClientPacket {
	public static readonly wireName = "VersionReq";
}
