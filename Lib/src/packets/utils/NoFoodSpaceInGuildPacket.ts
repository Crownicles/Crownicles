import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { PetFood } from "../../types/PetFood";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class NoFoodSpaceInGuildPacket extends CrowniclesPacket {
	food!: PetFood;

	quantity!: number;
}
