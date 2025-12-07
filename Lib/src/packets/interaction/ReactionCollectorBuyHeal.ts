import {
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorBuyHealData extends ReactionCollectorData {
	healPrice!: number;

	playerMoney!: number;
}

export class ReactionCollectorBuyHeal extends ReactionCollector {
	private readonly healPrice: number;

	private readonly playerMoney: number;

	constructor(healPrice: number, playerMoney: number) {
		super();
		this.healPrice = healPrice;
		this.playerMoney = playerMoney;
	}

	creationPacket(id: string, endTime: number, mainPacket: boolean): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			mainPacket,
			data: this.buildData(ReactionCollectorBuyHealData, {
				healPrice: this.healPrice,
				playerMoney: this.playerMoney
			}),
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			]
		};
	}
}
