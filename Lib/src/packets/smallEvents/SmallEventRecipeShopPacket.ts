import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { RecipeShopSource } from "../interaction/ReactionCollectorRecipeShopSmallEvent";
import { RecipeDisplayInfo } from "../../types/CookingTypes";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventRecipeShopAcceptedPacket extends SmallEventPacket {
	source!: RecipeShopSource;

	recipe!: RecipeDisplayInfo;

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
