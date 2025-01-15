import {
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket";

export class ReactionCollectorGuildLeaveData extends ReactionCollectorData {
	guildName!: string;

	newChiefKeycloakId!: string | null;
}

export class ReactionCollectorGuildLeave extends ReactionCollector {
	private readonly guildName: string;

	private readonly newChiefKeycloakId: string;

	constructor(guildName: string, newChiefKeycloakId: string) {
		super();
		this.guildName = guildName;
		this.newChiefKeycloakId = newChiefKeycloakId;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorGuildLeaveData, {
				guildName: this.guildName,
				newChiefKeycloakId: this.newChiefKeycloakId
			})
		};
	}
}