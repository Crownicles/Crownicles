import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.NONE)
export class SmallEventAnyShopAcceptedPacket extends SmallEventPacket {
}

@sendablePacket(PacketDirection.NONE)
export class SmallEventAnyShopRefusedPacket extends SmallEventPacket {
}

@sendablePacket(PacketDirection.NONE)
export class SmallEventAnyShopCannotBuyPacket extends SmallEventPacket {
}
