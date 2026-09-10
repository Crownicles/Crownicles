import { FromServerPacket } from "../FromServerPacket";

export const WITCH_OUTCOMES = {
	POTION: 0,
	EFFECT: 1,
	LIFE_LOSS: 2,
	NOTHING: 3
} as const;

export type WitchOutcome = typeof WITCH_OUTCOMES[keyof typeof WITCH_OUTCOMES];

export class SmallEventWitchResultRes extends FromServerPacket {
	public static readonly wireName = "SmallEventWitchResultRes";

	ingredientId!: string;

	isIngredient!: boolean;

	forceEffect!: boolean;

	effectId!: string;

	timeLostMinutes!: number;

	lifeLoss!: number;

	outcome!: WitchOutcome;

	discoveredRecipe?: {
		recipeId: string;
		level: number;
		recipeType: string;
	};
}
