import {
	AcceptRefusePacket,
	ReactionCollector, ReactionCollectorAcceptReaction,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import { OwnedPet } from "../../types/OwnedPet";
import { PetFood } from "../../types/PetFood";

export class ReactionCollectorPetFeedWithoutGuildData extends ReactionCollectorData {
	pet!: OwnedPet;

	food!: PetFood;

	price!: number;
}

export type ReactionCollectorPetFeedWithoutGuildPacket = AcceptRefusePacket<ReactionCollectorPetFeedWithoutGuildData>;

export class ReactionCollectorPetFeedWithoutGuild extends ReactionCollector {
	private readonly pet: OwnedPet;

	private readonly price: number;

	private readonly food: PetFood;

	constructor(pet: OwnedPet, food: PetFood, price: number) {
		super();
		this.pet = pet;
		this.price = price;
		this.food = food;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorPetFeedWithoutGuildPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorPetFeedWithoutGuildData, {
				pet: this.pet,
				price: this.price,
				food: this.food
			})
		};
	}
}
