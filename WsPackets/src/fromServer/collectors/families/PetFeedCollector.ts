import { OwnedPet } from "../../../objects/OwnedPet";
import { PetFood } from "../../../objects/PetFood";
import {
	ReactionCollectorDataKind, ReactionCollectorReactionKind
} from "../ReactionCollectorProtocol";

declare module "../ReactionCollectorProtocol" {
	interface ReactionCollectorDataPayloads {
		petFeedGuild: { pet: OwnedPet };
		petFeedPersonal: {
			pet: OwnedPet; food: PetFood; price: number;
		};
	}

	interface ReactionCollectorReactionPayloads {
		petFeedFood: {
			food: PetFood; amount: number; maxAmount: number;
		};
	}
}

export const PET_FEED_DATA_KINDS = {
	GUILD: "petFeedGuild", PERSONAL: "petFeedPersonal"
} as const satisfies Record<string, ReactionCollectorDataKind>;
export const PET_FEED_REACTION_KINDS = { FOOD: "petFeedFood" } as const satisfies Record<string, ReactionCollectorReactionKind>;
