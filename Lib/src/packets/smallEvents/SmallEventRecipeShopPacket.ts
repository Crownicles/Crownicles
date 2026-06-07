import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { RecipeShopSource } from "../interaction/ReactionCollectorRecipeShopSmallEvent";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventRecipeShopAcceptedPacket extends SmallEventPacket {
	source!: RecipeShopSource;

	recipeId!: string;

	recipeCost!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventRecipeShopRefusedPacket extends SmallEventPacket {
	source!: RecipeShopSource;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventRecipeShopCannotBuyPacket extends SmallEventPacket {
	source!: RecipeShopSource;
}
