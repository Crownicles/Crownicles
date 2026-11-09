import { FromClientPacket } from "./FromClientPacket";

export class FightReq extends FromClientPacket {
	public static readonly wireName = "FightReq";
}

export class FightResumeReq extends FromClientPacket {
	public static readonly wireName = "FightResumeReq";
}

/** A consequence-free fight against another player, met in a ranking or a guild, through the opaque handle sent with them. */
export class FriendlyFightReq extends FromClientPacket {
	public static readonly wireName = "FriendlyFightReq";

	public playerRef!: string;
}
