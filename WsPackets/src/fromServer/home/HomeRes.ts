import { FromServerPacket } from "../FromServerPacket";
import {
	HomeChestData, ChestError, PlantStorageEntry, PlayerPlantSlot, PlantTransferError
} from "../../objects/HomeChest";

export class HomeChestRes extends FromServerPacket {
	public static readonly wireName = "HomeChestRes";

	success!: boolean;

	error?: ChestError;

	data!: HomeChestData;
}
export class HomePlantTransferRes extends FromServerPacket {
	public static readonly wireName = "HomePlantTransferRes";

	success!: boolean;

	error?: PlantTransferError;

	plantStorage!: PlantStorageEntry[];

	playerPlantSlots!: PlayerPlantSlot[];
}
