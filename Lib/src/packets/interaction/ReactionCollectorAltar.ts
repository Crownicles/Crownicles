import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorAltarContributeReaction extends ReactionCollectorReaction {
	amount!: number;
}

export class ReactionCollectorAltarData extends ReactionCollectorData {
	poolAmount!: number;

	poolThreshold!: number;
}

type AltarReaction = ReactionCollectorAltarContributeReaction | ReactionCollectorRefuseReaction;
export type ReactionCollectorAltarPacket = ReactionCollectorCreationPacket<ReactionCollectorAltarData, AltarReaction>;

export class ReactionCollectorAltar extends ReactionCollector {
	private readonly contributionAmounts: number[];

	private readonly poolAmount: number;

	private readonly poolThreshold: number;

	constructor(contributionAmounts: number[], poolAmount: number, poolThreshold: number) {
		super();
		this.contributionAmounts = contributionAmounts;
		this.poolAmount = poolAmount;
		this.poolThreshold = poolThreshold;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorAltarPacket {
		return {
			id,
			endTime,
			reactions: [
				...this.contributionAmounts.map(amount => this.buildReaction(ReactionCollectorAltarContributeReaction, { amount })),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorAltarData, {
				poolAmount: this.poolAmount,
				poolThreshold: this.poolThreshold
			})
		};
	}
}
