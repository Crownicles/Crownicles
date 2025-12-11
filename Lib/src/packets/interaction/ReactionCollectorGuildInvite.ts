import {
	AcceptRefusePacket,
	ReactionCollector,
	ReactionCollectorAcceptReaction,
	ReactionCollectorData,
	ReactionCollectorRefuseReaction
} from "./ReactionCollectorPacket.js";

export class ReactionCollectorGuildInviteData extends ReactionCollectorData {
	guildName!: string;

	invitedPlayerKeycloakId!: string;
}

export type ReactionCollectorGuildInvitePacket = AcceptRefusePacket<ReactionCollectorGuildInviteData>;

export class ReactionCollectorGuildInvite extends ReactionCollector {
	private readonly guildName: string;

	private readonly invitedKeycloakId: string;

	constructor(guildName: string, invitedId: string) {
		super();
		this.guildName = guildName;
		this.invitedKeycloakId = invitedId;
	}

	creationPacket(id: string, endTime: number): ReactionCollectorGuildInvitePacket {
		return {
			id,
			endTime,
			reactions: [
				this.buildReaction(ReactionCollectorAcceptReaction, {}),
				this.buildReaction(ReactionCollectorRefuseReaction, {})
			],
			data: this.buildData(ReactionCollectorGuildInviteData, {
				invitedPlayerKeycloakId: this.invitedKeycloakId,
				guildName: this.guildName
			})

		};
	}
}
