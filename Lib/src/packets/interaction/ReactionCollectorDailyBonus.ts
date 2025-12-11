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

type DailyBonusReaction = ReactionCollectorDailyBonusReaction | ReactionCollectorRefuseReaction;
export type ReactionCollectorDailyBonusPacket = ReactionCollectorCreationPacket<
	ReactionCollectorDailyBonusData,
	DailyBonusReaction
>;


export class ReactionCollectorDailyBonus extends ReactionCollector {
	private readonly objects!: ItemWithDetails[];

	constructor(objects: ItemWithDetails[]) {
		super();
		this.objects = objects;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorDailyBonusPacket {
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
