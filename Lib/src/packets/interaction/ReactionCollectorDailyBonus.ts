import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import { ItemWithDetails } from "../../types/ItemWithDetails";

export class ReactionCollectorDailyBonusData extends ReactionCollectorData {}

export class ReactionCollectorDailyBonusReaction extends ReactionCollectorReaction {
	object!: ItemWithDetails;
}

export class ReactionCollectorDailyBonus extends ReactionCollector {
	private readonly objects!: ItemWithDetails[];

	constructor(objects: ItemWithDetails[]) {
		super();
		this.objects = objects;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			reactions: [
				...this.objects.map(object => this.buildReaction(ReactionCollectorDailyBonusReaction, { object })),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorDailyBonusData, {})
		};
	}
}
