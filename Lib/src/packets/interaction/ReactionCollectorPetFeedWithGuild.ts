import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData, ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import { OwnedPet } from "../../types/OwnedPet";
import { PetFood } from "../../types/PetFood";

export class ReactionCollectorPetFeedWithGuildData extends ReactionCollectorData {
	pet!: OwnedPet;
}

export class ReactionCollectorPetFeedWithGuildFoodReaction extends ReactionCollectorReaction {
	food!: PetFood;

	amount!: number;

	maxAmount!: number;
}

type PetFeedWithGuildReaction = ReactionCollectorPetFeedWithGuildFoodReaction | ReactionCollectorRefuseReaction;
export type ReactionCollectorPetFeedWithGuildPacket = ReactionCollectorCreationPacket<
	ReactionCollectorPetFeedWithGuildData,
	PetFeedWithGuildReaction
>;

export class ReactionCollectorPetFeedWithGuild extends ReactionCollector {
	private readonly pet: OwnedPet;

	private readonly foods: {
		food: PetFood; amount: number; maxAmount: number;
	}[];

	constructor(pet: OwnedPet, foods: {
		food: PetFood; amount: number; maxAmount: number;
	}[]) {
		super();
		this.pet = pet;
		this.foods = foods;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorPetFeedWithGuildPacket {
		return {
			id,
			endTime,
			reactions: [
				...this.foods.map(({
					food, amount, maxAmount
				}) => this.buildReaction(ReactionCollectorPetFeedWithGuildFoodReaction, {
					food,
					amount,
					maxAmount
				})),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorPetFeedWithGuildData, {
				pet: this.pet
			})
		};
	}
}
