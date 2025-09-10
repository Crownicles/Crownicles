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

		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorExitCityReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {}),
				...mealsReactions,
				...roomsReactions
			],
			data: this.buildData(ReactionCollectorCityData, {
				...this.data
			})
		};
	}
}
