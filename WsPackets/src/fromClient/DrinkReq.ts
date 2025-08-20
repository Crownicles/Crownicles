import { FromClientPacket } from "./FromClientPacket";

export class DrinkReq extends FromClientPacket {
	public force!: boolean;

	public slot?: number;
}
