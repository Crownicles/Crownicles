import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export enum RecipeShopSource {
	FARMER = "farmer",
	GASPARD_JO = "gaspardJo"
}

export class RecipeShopFarmerContext {
	interactionName!: string;

	amount?: number;
}

export class RecipeShopUltimateFoodMerchantContext {
	interactionName!: string;

	amount?: number;
}

export class ReactionCollectorRecipeShopSmallEventData extends ReactionCollectorData {
	source!: RecipeShopSource;

	recipeId!: string;

	recipeCost!: number;

	farmer?: RecipeShopFarmerContext;

	ultimateFoodMerchant?: RecipeShopUltimateFoodMerchantContext;
}

export type ReactionCollectorRecipeShopSmallEventPacket = AcceptRefusePacket<ReactionCollectorRecipeShopSmallEventData>;

export class ReactionCollectorRecipeShopSmallEvent extends ReactionCollector {
	private readonly data: ReactionCollectorRecipeShopSmallEventData;

	constructor(data: ReactionCollectorRecipeShopSmallEventData) {
		super();
		this.data = data;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorRecipeShopSmallEventPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorRecipeShopSmallEventData, this.data)
		};
	}
}
