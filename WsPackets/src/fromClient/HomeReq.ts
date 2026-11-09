import { FromClientPacket } from "./FromClientPacket";
import {
	ChestAction, PlantTransferAction
} from "../objects/HomeChest";
import { PlantId } from "../objects/PlantId";

export class HomeChestInfoReq extends FromClientPacket {
	public static readonly wireName = "HomeChestInfoReq";
}
export class HomeChestActionReq extends FromClientPacket {
	public static readonly wireName = "HomeChestActionReq";

	action!: ChestAction;

	slot!: number;

	itemCategory!: number;

	chestSlot!: number;
}
export class HomePlantTransferReq extends FromClientPacket {
	public static readonly wireName = "HomePlantTransferReq";

	action!: PlantTransferAction;

	plantId!: PlantId | 0;

	playerSlot!: number;
}
