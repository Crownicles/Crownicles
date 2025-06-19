import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket.js";
import { ItemNature } from "../../constants/ItemConstants";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandDailyBonusPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDailyBonusNoActiveObject extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDailyBonusInCooldown extends CrowniclesPacket {
	timeBetweenDailies!: number;

	lastDailyTimestamp!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDailyBonusObjectIsActiveDuringFights extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDailyBonusObjectDoNothing extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandDailyBonusPacketRes extends CrowniclesPacket {
	value!: number;

	itemNature!: ItemNature;
}
