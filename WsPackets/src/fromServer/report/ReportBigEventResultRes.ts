import { FromServerPacket } from "../FromServerPacket";

/** The consequences applied after the player chooses a possibility in a big event. */
export class ReportBigEventResultRes extends FromServerPacket {
	eventId!: number;

	possibilityId!: string;

	outcomeId!: string;

	score!: number;

	experience!: number;

	effect?: {
		name: string;
		time: number;
	};

	health!: number;

	money!: number;

	energy!: number;

	gems!: number;

	tokens!: number;

	oneshot!: boolean;
}
