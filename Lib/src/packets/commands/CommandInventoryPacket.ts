import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import {
	ItemNature, ItemRarity
} from "../../constants/ItemConstants";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandInventoryPacketReq extends CrowniclesPacket {
	askedPlayer!: {
		rank?: number;
		keycloakId?: string;
	};
}

export interface MainItemDisplayPacket {
	id: number;
	rarity: ItemRarity;
	itemCategory: number;
	attack: {
		value: number;
		max: number;
	};
	defense: {
		value: number;
		max: number;
	};
	speed: {
		value: number;
		max: number;
	};
}

export interface SupportItemDisplayPacket {
	id: number;
	rarity: number;
	nature: ItemNature;
	power: number;
	maxPower: number;
	itemCategory: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandInventoryPacketRes extends CrowniclesPacket {
	foundPlayer!: boolean;

	keycloakId?: string;

	/**
	 * Whether the player has the expedition talisman
	 */
	hasTalisman?: boolean;

	/**
	 * Whether the player has the clone talisman (pet counts in defense fights and small events while on expedition)
	 */
	hasCloneTalisman?: boolean;

	data?: {
		weapon: MainItemDisplayPacket;
		armor: MainItemDisplayPacket;
		potion: SupportItemDisplayPacket;
		object: SupportItemDisplayPacket;
		backupWeapons: {
			display: MainItemDisplayPacket; slot: number;
		}[];
		backupArmors: {
			display: MainItemDisplayPacket; slot: number;
		}[];
		backupPotions: {
			display: SupportItemDisplayPacket; slot: number;
		}[];
		backupObjects: {
			display: SupportItemDisplayPacket; slot: number;
		}[];
		slots: {
			weapons: number;
			armors: number;
			potions: number;
			objects: number;
		};
	};
}
