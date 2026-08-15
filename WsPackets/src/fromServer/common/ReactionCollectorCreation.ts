import { FromServerPacket } from "../FromServerPacket";
import {
	ReactionCollectorData, ReactionCollectorReaction
} from "../collectors";

export class ReactionCollectorCreation extends FromServerPacket {
	id!: string;

	data!: ReactionCollectorData;

	/**
	 * Order is significant: a client answers a collector by the index of its choice in this array.
	 */
	reactions!: ReactionCollectorReaction[];

	endTime!: number;

	mainPacket?: boolean = true;
}
