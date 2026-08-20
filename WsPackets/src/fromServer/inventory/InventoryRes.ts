import { FromServerPacket } from "../FromServerPacket";
import { MaterialQuantity } from "../../objects/MaterialQuantity";
import { SupportItem } from "../../objects/SupportItem";
import { MainItem } from "../../objects/MainItem";
import { PlantId } from "../../objects/PlantId";

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
		materials: MaterialQuantity[];
		plants?: {
			seed?: PlantId;
			plantSlots: {
				plantId: PlantId;
				slot: number;
			}[];
			maxPlantSlots: number;
		};
	};

	hasTalisman?: boolean;

	hasCloneTalisman?: boolean;

	hasRemoteHarvestTalisman?: boolean;
}
