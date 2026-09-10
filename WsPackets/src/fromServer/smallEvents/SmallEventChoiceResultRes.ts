import { FromServerPacket } from "../FromServerPacket";

type RecipeDisplay = {
	recipeId: string;
	level: number;
	recipeType: string;
};

export type SmallEventChoiceResult =
	| {
		event: "altar"; outcome: "notContributed"; amount: number; current: number; threshold: number; canAfford: boolean;
	}
	| {
		event: "altar"; outcome: "contributed"; amount: number; current: number; threshold: number; blessingTriggered: boolean; blessingType: number; bonusGems: number; bonusItemGiven: boolean; badgeAwarded: boolean;
	}
	| {
		event: "badPet"; outcome: "resolved"; loveLost: number; actionId: string; petId: number; sex: string; petNickname?: string;
	}
	| {
		event: "cart"; outcome: "resolved"; accepted: boolean; canAfford: boolean; isScam: boolean; destinationWasKnown: boolean; pointsWon: number;
	}
	| {
		event: "fightPet"; outcome: "success" | "failure"; actionId: string; isFemale: boolean;
	}
	| {
		event: "gardener"; outcome: "resolved"; interactionName: string; plantId: number; materialId: number; cost: number; conditionKey: string;
	}
	| {
		event: "pveIsland"; outcome: "accepted"; alone: boolean; pointsWon: number;
	}
	| {
		event: "pveIsland"; outcome: "notEnoughGems";
	}
	| {
		event: "goblets"; outcome: "resolved"; malus: "life" | "time" | "nothing" | "end" | "item"; goblet: string; value: number; strategy: "classic" | "risky" | "safe" | "gambler"; itemId?: number; itemCategory?: number;
	}
	| {
		event: "interactPoor"; outcome: "donated";
	}
	| {
		event: "limoges";
		outcome: "success" | "failure";
		questionId: string;
		shouldHaveAccepted: boolean;
		reward?: {
			experience: number; score: number;
		};
		penalty?: {
			type: "health" | "money" | "time"; amount: number;
		};
	}
	| {
		event: "petFood"; outcome: "found_by_player" | "found_by_pet" | "found_anyway" | "nothing" | "pet_failed" | "player_failed"; foodType: string; loveChange: number; petSex: string; timeLostMinutes?: number;
	}
	| {
		event: "recipeShop"; outcome: "accepted"; source: "farmer" | "gaspardJo"; recipe: RecipeDisplay; recipeCost: number;
	}
	| {
		event: "recipeShop"; outcome: "cannotBuy"; source: "farmer" | "gaspardJo";
	}
	| {
		event: "shop" | "epicShop"; outcome: "purchased" | "cannotBuy";
	};

export class SmallEventChoiceResultRes extends FromServerPacket {
	public static readonly wireName = "SmallEventChoiceResultRes";

	result!: SmallEventChoiceResult;
}
