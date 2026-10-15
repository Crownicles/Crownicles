import { FromServerPacket } from "../FromServerPacket";
import { ItemNature } from "../../objects/ItemNature";

export class DailyBonusRes extends FromServerPacket {
	public static readonly wireName = "DailyBonusRes";

	value!: number;

	itemNature!: ItemNature;
}

export class DailyBonusCooldownRes extends FromServerPacket {
	public static readonly wireName = "DailyBonusCooldownRes";

	cooldownHours!: number;

	lastDailyTimestamp!: number;
}

export class DailyBonusNoObjectRes extends FromServerPacket {
	public static readonly wireName = "DailyBonusNoObjectRes";
}

export class DailyBonusCancelRes extends FromServerPacket {
	public static readonly wireName = "DailyBonusCancelRes";
}
