import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorGuildCreateData extends ReactionCollectorData {
	guildName!: string;
}

export type ReactionCollectorGuildCreatePacket = AcceptRefusePacket<ReactionCollectorGuildCreateData>;

export class ReactionCollectorGuildCreate extends ReactionCollector {
	private readonly guildName: string;

	constructor(guildName: string) {
		super();
		this.guildName = guildName;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorGuildCreatePacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorGuildCreateData, {
				guildName: this.guildName
			})
		};
	}
}
