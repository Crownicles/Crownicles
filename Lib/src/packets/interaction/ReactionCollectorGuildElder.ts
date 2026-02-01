import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorGuildElderData extends ReactionCollectorData {
	guildName!: string;

	promotedKeycloakId!: string;
}

export type ReactionCollectorGuildElderPacket = AcceptRefusePacket<ReactionCollectorGuildElderData>;

export class ReactionCollectorGuildElder extends ReactionCollector {
	private readonly guildName: string;

	private readonly promotedKeycloakId: string;

	constructor(guildName: string, promotedKeycloakId: string) {
		super();
		this.guildName = guildName;
		this.promotedKeycloakId = promotedKeycloakId;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorGuildElderPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorGuildElderData, {
				guildName: this.guildName,
				promotedKeycloakId: this.promotedKeycloakId
			})
		};
	}
}
