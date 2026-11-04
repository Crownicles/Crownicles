import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

export const FRIENDLY_FIGHT_ERRORS = {
	OPPONENT_NOT_FOUND: "opponentNotFound",
	SELF_FIGHT: "selfFight",
	OPPONENT_LEVEL_TOO_LOW: "opponentLevelTooLow"
} as const;

export type FriendlyFightError = typeof FRIENDLY_FIGHT_ERRORS[keyof typeof FRIENDLY_FIGHT_ERRORS];

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandFriendlyFightPacketReq extends CrowniclesPacket {
	askedPlayer!: {
		rank?: number;
		keycloakId?: string;
	};
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandFriendlyFightErrorPacketRes extends CrowniclesPacket {
	error!: FriendlyFightError;
}
