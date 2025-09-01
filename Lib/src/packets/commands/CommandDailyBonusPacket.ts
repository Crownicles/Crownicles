import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket.js";
import { ItemNature } from "../../constants/ItemConstants";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandDailyBonusPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDailyBonusNoAvailableObject extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDailyBonusInCooldown extends CrowniclesPacket {
	timeBetweenDailies!: number;

	lastDailyTimestamp!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDailyBonusCancelPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDailyBonusPacketRes extends CrowniclesPacket {
	value!: number;

	itemNature!: ItemNature;
}
