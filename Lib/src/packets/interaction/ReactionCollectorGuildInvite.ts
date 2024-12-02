import {
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorCreationPacket,
	ReactionCollectorData, ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket.js";

export class ReactionCollectorGuildInviteData extends ReactionCollectorData {
	guildName!: string;

	invitedPlayerKeycloakId!: string;
}

export class ReactionCollectorGuildInvite extends ReactionCollector {
	private readonly guildName: string;

	private readonly inviterKeycloakId: string;

	constructor(guildName: string, inviterId: string) {
		super();
		this.guildName = guildName;
		this.inviterKeycloakId = inviterId;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorCreationPacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorGuildInviteData, {
				invitedPlayerKeycloakId: this.inviterKeycloakId,
				guildName: this.guildName
			})

		};
	}
}