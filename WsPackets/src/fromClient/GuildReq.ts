import { FromClientPacket } from "./FromClientPacket";
import { AskedPlayer } from "../objects/AskedPlayer";

export class GuildReq extends FromClientPacket {
	public static readonly wireName = "GuildReq";

	public askedPlayer!: AskedPlayer;

	public askedGuildName?: string;
}
export class GuildCreateReq extends FromClientPacket {
	public static readonly wireName = "GuildCreateReq";

	public askedGuildName!: string;
}
export class GuildStorageReq extends FromClientPacket {
	public static readonly wireName = "GuildStorageReq";
}
export class GuildDailyReq extends FromClientPacket {
	public static readonly wireName = "GuildDailyReq";
}
