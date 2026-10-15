import { FromServerPacket } from "../FromServerPacket";
import { PetSex } from "../../objects/OwnedPet";
import { RecipeDisplay } from "../../objects/RecipeDisplay";
import type {
	SmallEventBadPetActionId, SmallEventGobletId, SmallEventRecipeShopSource
} from "../collectors";

export type SmallEventChoiceResult =
	| {
		event: "altar"; outcome: "notContributed"; amount: number; current: number; threshold: number; canAfford: boolean;
	}
	| {
		event: "altar"; outcome: "contributed"; amount: number; current: number; threshold: number; blessingTriggered: boolean; blessingType: number; bonusGems: number; bonusItemGiven: boolean; badgeAwarded: boolean;
	}
	| {
		event: "badPet"; outcome: "resolved"; loveLost: number; actionId: SmallEventBadPetActionId; petId: number; sex: PetSex; petNickname?: string;
	}
	| {
		event: "cart"; outcome: "resolved"; accepted: boolean; canAfford: boolean; isScam: boolean; isDisplayed: boolean; pointsWon: number;
	}
	| {
		event: "fightPet"; outcome: "success" | "failure"; actionId: string; isFemale: boolean;
	}
	| {
		event: "gardener";
		outcome: "resolved";
		interactionName: string;
		conditionKey: string;
		plantId: number;
		materialId: number;
		cost: number;

		/** Only set when the gardener speaks first; an answer to his offer carries no story. */
		isFirstEncounter?: boolean;

		/** What the advice asks the player to reach before the seed can be offered. */
		requiredLevel?: number;
		requiredMoney?: number;
	}
	| {
		event: "pveIsland"; outcome: "accepted"; alone: boolean; pointsWon: number;
	}
	| {
		event: "pveIsland"; outcome: "notEnoughGems";
	}
	| {
		event: "goblets"; outcome: "resolved"; malus: "life" | "time" | "nothing" | "end" | "item"; goblet: SmallEventGobletId; value: number;
	}
	| {
		event: "interactPoor"; outcome: "donated";
	}
	| {
		event: "limoges";
		outcome: "success" | "failure";
		shouldHaveAccepted: boolean;
		reward?: {
			experience: number; score: number;
		};
		penalty?: {
			type: "health" | "money" | "time"; amount: number;
		};
	}
	| {
		event: "petFood"; outcome: "found_by_player" | "found_by_pet" | "found_anyway" | "nothing" | "pet_failed" | "player_failed"; foodType: string; petSex: PetSex; loveChange: number; timeLostMinutes?: number;
	}
	| {
		event: "recipeShop"; outcome: "accepted"; source: SmallEventRecipeShopSource; recipe: RecipeDisplay; recipeCost: number;
	}
	| {
		event: "recipeShop"; outcome: "cannotBuy"; source: SmallEventRecipeShopSource;
	}
	| {
		event: "shop" | "epicShop"; outcome: "purchased" | "cannotBuy";
	};

export class SmallEventChoiceResultRes extends FromServerPacket {
	public static readonly wireName = "SmallEventChoiceResultRes";

	result!: SmallEventChoiceResult;
}
