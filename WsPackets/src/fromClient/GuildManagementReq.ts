import { FromClientPacket } from "./FromClientPacket";

export class GuildDescriptionReq extends FromClientPacket {
	public static readonly wireName = "GuildDescriptionReq";

	public description!: string;
}

export class GuildLeaveReq extends FromClientPacket {
	public static readonly wireName = "GuildLeaveReq";
}
