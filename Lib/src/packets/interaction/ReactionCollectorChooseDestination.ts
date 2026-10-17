import {
	ReactionCollector,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorChooseDestinationReaction extends ReactionCollectorReaction {
	mapId!: number;

	mapTypeId!: string;

	tripDuration?: number;
}

/**
 * Reaction offered alongside the travel destinations when the player is standing
 * in a city: instead of leaving, they can stay in the city (defer the destination
 * choice and open the city menu on the next reports).
 */
export class ReactionCollectorStayInCityReaction extends ReactionCollectorReaction {}

export class ReactionCollectorChooseDestinationData extends ReactionCollectorData {

}

export type ReactionCollectorChooseDestinationPacket = ReactionCollectorCreationPacket<
	ReactionCollectorChooseDestinationData,
	ReactionCollectorChooseDestinationReaction | ReactionCollectorStayInCityReaction
>;

export class ReactionCollectorChooseDestination extends ReactionCollector {
	private readonly maps: ReactionCollectorChooseDestinationReaction[];

	private readonly canStayInCity: boolean;

	constructor(maps: ReactionCollectorChooseDestinationReaction[], canStayInCity = false) {
		super();
		this.maps = maps;
		this.canStayInCity = canStayInCity;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorChooseDestinationPacket {
		const reactions: {
			type: string; data: ReactionCollectorReaction;
		}[] = [];
		for (const map of this.maps) {
			reactions.push(this.buildReaction(ReactionCollectorChooseDestinationReaction, map));
		}
		if (this.canStayInCity) {
			reactions.push(this.buildReaction(ReactionCollectorStayInCityReaction, {}));
		}

		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorChooseDestinationData, {})
		};
	}
}
