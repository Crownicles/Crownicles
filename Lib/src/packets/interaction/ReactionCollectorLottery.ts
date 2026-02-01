import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorLotteryEasyReaction extends ReactionCollectorReaction {

}

export class ReactionCollectorLotteryMediumReaction extends ReactionCollectorReaction {

}

export class ReactionCollectorLotteryHardReaction extends ReactionCollectorReaction {

}

export class ReactionCollectorLotteryData extends ReactionCollectorData {

}

type LotteryReaction = ReactionCollectorLotteryEasyReaction | ReactionCollectorLotteryMediumReaction | ReactionCollectorLotteryHardReaction;
export type ReactionCollectorLotteryPacket = ReactionCollectorCreationPacket<
	ReactionCollectorLotteryData,
	LotteryReaction
>;

export class ReactionCollectorLottery extends ReactionCollector {
	creationPacket(id: string, endTime: number): ReactionCollectorLotteryPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorLotteryEasyReaction, {}),
				this.buildReaction(ReactionCollectorLotteryMediumReaction, {}),
				this.buildReaction(ReactionCollectorLotteryHardReaction, {})
			],
			data: this.buildData(ReactionCollectorLotteryData, {})
		};
	}
}
