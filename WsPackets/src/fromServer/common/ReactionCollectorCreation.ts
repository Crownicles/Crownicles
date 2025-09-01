import {FromServerPacket} from "../FromServerPacket";
import {ReactionCollectorData} from "./ReactionCollectorData";
import {ReactionCollectorReaction} from "./ReactionCollectorReaction";

export class ReactionCollectorCreation extends FromServerPacket {
	id!: string;

	data!: {
		type: string;
		data: ReactionCollectorData;
	};

	reactions!: {
		type: string;
		data: ReactionCollectorReaction;
	}[];

	endTime!: number;

	mainPacket?: boolean = true;
}