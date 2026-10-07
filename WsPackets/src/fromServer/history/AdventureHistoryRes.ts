import { FromServerPacket } from "../FromServerPacket";
import { AdventureHistoryEvent } from "../../objects/AdventureHistory";

export class AdventureHistoryRes extends FromServerPacket {
	public static readonly wireName = "AdventureHistoryRes";

	available = true;

	entries!: AdventureHistoryEvent[];

	until!: number;

	windowStartsAt!: number;

	nextPage?: number;
}
