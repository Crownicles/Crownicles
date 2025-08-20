import {
	SmallEventAnyShopAcceptedPacket,
	SmallEventAnyShopCannotBuyPacket,
	SmallEventAnyShopRefusedPacket
} from "./SmallEventAnyShopPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventEpicItemShopAcceptPacket extends SmallEventAnyShopAcceptedPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventEpicItemShopRefusePacket extends SmallEventAnyShopRefusedPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventEpicItemShopCannotBuyPacket extends SmallEventAnyShopCannotBuyPacket {
}

