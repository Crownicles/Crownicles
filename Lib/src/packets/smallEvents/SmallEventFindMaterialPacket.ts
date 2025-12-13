import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SmallEventPacket } from "./SmallEventPacket";
import { MaterialRarity } from "../../types/MaterialRarity";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventFindMaterialPacket extends SmallEventPacket {
	materialId!: string;

	materialType!: string;

	materialRarity!: MaterialRarity;
}
