import { FromServerPacket } from "../FromServerPacket";

export class CommandDrinkConsumePotionRes extends FromServerPacket {
	health?: number;

	energy?: number;

	time?: number;
}
