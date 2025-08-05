import { FromServerPacket } from "../FromServerPacket";
import { SupportItem } from "../../objects/SupportItem";
import { MainItem } from "../../objects/MainItem";

export class InventoryRes extends FromServerPacket {
	foundPlayer!: boolean;

	data?: {
		weapon: MainItem;
		armor: MainItem;
		potion: SupportItem;
		object: SupportItem;
		backupWeapons: {
			display: MainItem;
			slot: number;
		}[];
		backupArmors: {
			display: MainItem;
			slot: number;
		}[];
		backupPotions: {
			display: SupportItem;
			slot: number;
		}[];
		backupObjects: {
			display: SupportItem;
			slot: number;
		}[];
		slots: {
			weapons: number;
			armors: number;
			potions: number;
			objects: number;
		};
	};
}
