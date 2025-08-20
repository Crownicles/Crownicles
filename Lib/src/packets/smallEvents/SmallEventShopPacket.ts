import {
	SmallEventAnyShopAcceptedPacket,
	SmallEventAnyShopCannotBuyPacket,
	SmallEventAnyShopRefusedPacket
} from "./SmallEventAnyShopPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventShopAcceptPacket extends SmallEventAnyShopAcceptedPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventShopRefusePacket extends SmallEventAnyShopRefusedPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventShopCannotBuyPacket extends SmallEventAnyShopCannotBuyPacket {
}
