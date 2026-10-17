import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { RecipeDisplayInfo } from "../../types/CookingTypes";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventWitchResultPacket extends SmallEventPacket {
	ingredientId!: string;

	isIngredient!: boolean;

	forceEffect!: boolean;

	effectId!: string;

	timeLost!: number;

	lifeLoss!: number;

	outcome!: number;

	discoveredRecipe?: RecipeDisplayInfo;
}
