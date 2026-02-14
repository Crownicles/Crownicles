import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { ItemCategory } from "../../constants/ItemConstants";
import { ItemWithDetails } from "../../types/ItemWithDetails";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandEquipPacketReq extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandEquipErrorNoItem extends CrowniclesPacket {
}

/**
 * Data for a single inventory category in the equip menu.
 */
export interface EquipCategoryData {
	category: ItemCategory;
	equippedItem: {
		details: ItemWithDetails;
	} | null;
	reserveItems: {
		slot: number;
		details: ItemWithDetails;
	}[];
	maxReserveSlots: number;
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
