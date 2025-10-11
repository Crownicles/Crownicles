import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";
import { MainItemDetails } from "../../types/MainItemDetails";

export class ReactionCollectorCityData extends ReactionCollectorData {
	mapTypeId!: string;

	mapLocationId!: number;

	timeInCity!: number;

	inns?: {
		innId: string;
		meals: {
			mealId: string;
			price: number;
			energy: number;
		}[];
		rooms: {
			roomId: string;
			price: number;
			health: number;
		}[];
	}[];

	energy!: {
		current: number;
		max: number;
	};

	health!: {
		current: number;
		max: number;
	};

	enchanter?: {
		enchantableItems: MainItemDetails[];
		isInventoryEmpty: boolean; // If true, the inventory is empty, and we can't enchant anything. It is used to display the right message.
		hasAtLeastOneEnchantedItem: boolean; // If true, the player has at least one enchanted item, so the enchanter must say that it cannot remove enchantments.
		enchantmentId: string;
		enchantmentCost: {
			money: number;
			gems: number;
		};
		mageReduction: boolean;
	};
}

export class ReactionCollectorExitCityReaction extends ReactionCollectorReaction {}

export class ReactionCollectorInnMealReaction extends ReactionCollectorReaction {
	innId!: string;

	meal!: {
		mealId: string;
		price: number;
		energy: number;
	};
}

export class ReactionCollectorInnRoomReaction extends ReactionCollectorReaction {
	innId!: string;

	room!: {
		roomId: string;
		price: number;
		health: number;
	};
}

export class ReactionCollectorEnchantReaction extends ReactionCollectorReaction {
	itemId!: number;

	itemCategory!: number;
}

export class ReactionCollectorCity extends ReactionCollector {
	private readonly data!: ReactionCollectorCityData;

	constructor(data: ReactionCollectorCityData) {
		super();
		this.data = data;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		const mealsReactions = this.data.inns?.flatMap(inn =>
			inn.meals.map(meal =>
				this.buildReaction(ReactionCollectorInnMealReaction, {
					innId: inn.innId,
					meal
				}))) || [];

		const roomsReactions = this.data.inns?.flatMap(inn =>
			inn.rooms.map(room =>
				this.buildReaction(ReactionCollectorInnRoomReaction, {
					innId: inn.innId,
					room
				}))) || [];

		const enchantReactions = this.data.enchanter?.enchantableItems.map(item =>
			this.buildReaction(ReactionCollectorEnchantReaction, {
				itemId: item.id,
				itemCategory: item.itemCategory
			})) || [];

		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorExitCityReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {}),
				...mealsReactions,
				...roomsReactions,
				...enchantReactions
			],
			data: this.buildData(ReactionCollectorCityData, {
				...this.data
			})
		};
	}
}
