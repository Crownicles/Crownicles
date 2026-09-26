import { FromServerPacket } from "../FromServerPacket";
import {
	GuildCommandOutcome, GuildData
} from "../../objects/Guild";

export class GuildRes extends FromServerPacket {
	public static readonly wireName = "GuildRes";

	public foundGuild!: boolean;

	public data?: GuildData;
}
export class GuildStorageRes extends FromServerPacket {
	public static readonly wireName = "GuildStorageRes";

	public foods!: {
		id: string; amount: number; maxAmount: number;
	}[];

	public guildName!: string;
}
export class GuildCommandRes extends FromServerPacket {
	public static readonly wireName = "GuildCommandRes";

	public outcome!: GuildCommandOutcome;
}
