import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorGuildDescriptionData extends ReactionCollectorData {
	description!: string;
}

export type ReactionCollectorGuildDescriptionPacket = AcceptRefusePacket<ReactionCollectorGuildDescriptionData>;

export class ReactionCollectorGuildDescription extends ReactionCollector {
	private readonly description: string;

	constructor(description: string) {
		super();
		this.description = description;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorGuildDescriptionPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorGuildDescriptionData, {
				description: this.description
			})
		};
	}
}
