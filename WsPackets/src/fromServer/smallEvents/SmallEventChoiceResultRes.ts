import { FromServerPacket } from "../FromServerPacket";
import { PetSex } from "../../objects/OwnedPet";
import { RecipeDisplay } from "../../objects/RecipeDisplay";
import type {
	SmallEventBadPetActionId, SmallEventGobletId
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
		event: "cart"; outcome: "resolved"; accepted: boolean; canAfford: boolean; isScam: boolean; pointsWon: number;
	}
	| {
		event: "fightPet"; outcome: "success" | "failure"; actionId: string; isFemale: boolean;
	}
	| {
		event: "gardener"; outcome: "resolved"; interactionName: string; plantId: number; materialId: number; cost: number;
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
		reward?: {
			experience: number; score: number;
		};
		penalty?: {
			type: "health" | "money" | "time"; amount: number;
		};
	}
	| {
		event: "petFood"; outcome: "found_by_player" | "found_by_pet" | "found_anyway" | "nothing" | "pet_failed" | "player_failed"; loveChange: number; timeLostMinutes?: number;
	}
	| {
		event: "recipeShop"; outcome: "accepted"; recipe: RecipeDisplay; recipeCost: number;
	}
	| {
		event: "recipeShop"; outcome: "cannotBuy";
	}
	| {
		event: "shop" | "epicShop"; outcome: "purchased" | "cannotBuy";
	};

export class SmallEventChoiceResultRes extends FromServerPacket {
	public static readonly wireName = "SmallEventChoiceResultRes";

	result!: SmallEventChoiceResult;
}
