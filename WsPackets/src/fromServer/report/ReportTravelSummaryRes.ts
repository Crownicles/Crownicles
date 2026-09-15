import { FromServerPacket } from "../FromServerPacket";

export class ReportTravelSummaryRes extends FromServerPacket {
	public static readonly wireName = "ReportTravelSummaryRes";

	startMap!: {
		id: number;
		type: string;
	};

	endMap!: {
		id: number;
		type: string;
	};

	startTime!: number;

	arriveTime!: number;

	nextStopTime!: number;

	isOnBoat!: boolean;

	effect?: string;

	effectDuration?: number;

	effectEndTime?: number;

	points!: {
		show: boolean;
		cumulated: number;
	};

	energy!: {
		show: boolean;
		current: number;
		max: number;
	};

	lastSmallEventId?: string;

	tokens?: {
		cost: number;
		canAfford: boolean;
	};

	heal?: {
		price: number;
		canAfford: boolean;
	};

	isInCity!: boolean;
}
