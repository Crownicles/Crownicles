import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorCityData extends ReactionCollectorData {
	mapTypeId!: string;

	mapLocationId!: number;

	timeInCity!: number;

	inns?: {
		innId: string;
		meals: {
			mealId: string;
			price: number;
			health: number;
		}[];
	}[];
}

export class ReactionCollectorExitCityReaction extends ReactionCollectorReaction {}

export class ReactionCollectorInnMealReaction extends ReactionCollectorReaction {
	innId!: string;

	mealId!: string;
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
					innId: inn.innId, mealId: meal.mealId
				}))) || [];

		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorExitCityReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {}),
				...mealsReactions
			],
			data: this.buildData(ReactionCollectorCityData, {
				...this.data
			})
		};
	}
}
