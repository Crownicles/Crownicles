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

	enterInCity!: boolean;
}

export class ReactionCollectorChooseDestinationData extends ReactionCollectorData {

}

export type ReactionCollectorChooseDestinationPacket = ReactionCollectorCreationPacket<
	ReactionCollectorChooseDestinationData,
	ReactionCollectorChooseDestinationReaction
>;

export class ReactionCollectorChooseDestination extends ReactionCollector {
	private readonly maps: ReactionCollectorChooseDestinationReaction[];

	constructor(maps: ReactionCollectorChooseDestinationReaction[]) {
		super();
		this.maps = maps;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorChooseDestinationPacket {
		const reactions = [];
		for (const map of this.maps) {
			reactions.push(this.buildReaction(ReactionCollectorChooseDestinationReaction, map));
		}

		return {
			id,
			endTime,
			reactions,
			data: this.buildData(ReactionCollectorChooseDestinationData, {})
		};
	}
}
