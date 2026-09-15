import { FromServerPacket } from "../FromServerPacket";

export type SmallEventResultData = {
	amount?: number;
	money?: number;
	moneyLost?: number;
	lifeLost?: number;
	quantity?: number;
	xp?: number;
	effectId?: string;
	materialId?: string;
};

export class SmallEventResultRes extends FromServerPacket {
	public static readonly wireName = "SmallEventResultRes";

	eventName!: string;

	data!: SmallEventResultData;
}
