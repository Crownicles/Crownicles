import { FromServerPacket } from "../FromServerPacket";
import { CookingOutcome } from "../../objects/Cooking";

export class CookingRes extends FromServerPacket {
	public static readonly wireName = "CookingRes";

	outcome!: CookingOutcome;
}
