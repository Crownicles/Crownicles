import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { MainItemDetails } from "../../types/MainItemDetails";
import { SupportItemDetails } from "../../types/SupportItemDetails";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandInventoryPacketReq extends CrowniclesPacket {
	askedPlayer!: {
		rank?: number;
		keycloakId?: string;
	};
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandInventoryPacketRes extends CrowniclesPacket {
	foundPlayer!: boolean;

	keycloakId?: string;

	data?: {
		weapon: MainItemDetails;
		armor: MainItemDetails;
		potion: SupportItemDetails;
		object: SupportItemDetails;
		backupWeapons: {
			display: MainItemDetails; slot: number;
		}[];
		backupArmors: {
			display: MainItemDetails; slot: number;
		}[];
		backupPotions: {
			display: SupportItemDetails; slot: number;
		}[];
		backupObjects: {
			display: SupportItemDetails; slot: number;
		}[];
		slots: {
			weapons: number;
			armors: number;
			potions: number;
			objects: number;
		};
	};
}
