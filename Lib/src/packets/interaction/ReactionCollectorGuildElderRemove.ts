import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorGuildElderRemoveData extends ReactionCollectorData {
	guildName!: string;

	demotedKeycloakId!: string;
}

export type ReactionCollectorGuildElderRemovePacket = AcceptRefusePacket<ReactionCollectorGuildElderRemoveData>;

export class ReactionCollectorGuildElderRemove extends ReactionCollector {
	private readonly guildName: string;

	private readonly demotedKeycloakId: string;

	constructor(guildName: string, demotedKeycloakId: string) {
		super();
		this.guildName = guildName;
		this.demotedKeycloakId = demotedKeycloakId;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorGuildElderRemovePacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorGuildElderRemoveData, {
				guildName: this.guildName,
				demotedKeycloakId: this.demotedKeycloakId
			})
		};
	}
}
