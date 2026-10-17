import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorTokenMerchantData extends ReactionCollectorData {
	pricePerToken!: number;

	playerMoney!: number;

	playerTokens!: number;

	amounts!: number[];
}

export class ReactionCollectorTokenMerchantBuyReaction extends ReactionCollectorReaction {
	amount!: number;
}

export class ReactionCollectorTokenMerchant extends ReactionCollector {
	private readonly pricePerToken: number;

	private readonly playerMoney: number;

	private readonly playerTokens: number;

	private readonly amounts: number[];

	constructor(pricePerToken: number, playerMoney: number, playerTokens: number, amounts: number[]) {
		super();
		this.pricePerToken = pricePerToken;
		this.playerMoney = playerMoney;
		this.playerTokens = playerTokens;
		this.amounts = amounts;
	}

	creationPacket(id: string, endTime: number, mainPacket: boolean): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			mainPacket,
			data: this.buildData(ReactionCollectorTokenMerchantData, {
				pricePerToken: this.pricePerToken,
				playerMoney: this.playerMoney,
				playerTokens: this.playerTokens,
				amounts: this.amounts
			}),
			reactions: [
				...this.amounts.map(amount => this.buildReaction(ReactionCollectorTokenMerchantBuyReaction, { amount })),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			]
		};
	}
}
