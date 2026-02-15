import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { EquipCategoryData } from "../../types/EquipCategoryData";

export type { EquipCategoryData } from "../../types/EquipCategoryData";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandEquipPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandEquipErrorNoItem extends CrowniclesPacket {
}

/**
 * Async action request for equip/deposit via AsyncPacketSender.
 */
@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandEquipActionReq extends CrowniclesPacket {
	/** "equip" or "deposit" */
	action!: string;

	itemCategory!: number;

	/** The reserve slot number (for equip action) */
	slot!: number;
}

/**
 * Async action response with refreshed inventory data.
 */
@sendablePacket(PacketDirection.NONE)
export class CommandEquipActionRes extends CrowniclesPacket {
	success!: boolean;

	error?: string;

	categories!: EquipCategoryData[];
}
