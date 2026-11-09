import { FromClientPacket } from "./FromClientPacket";

export class PetCaressReq extends FromClientPacket {
	public static readonly wireName = "PetCaressReq";
}

export class PetNickReq extends FromClientPacket {
	public static readonly wireName = "PetNickReq";

	public newNickname?: string;
}

export class PetFeedReq extends FromClientPacket {
	public static readonly wireName = "PetFeedReq";
}
