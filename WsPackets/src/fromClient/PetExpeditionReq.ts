import { FromClientPacket } from "./FromClientPacket";

export class PetExpeditionReq extends FromClientPacket {
	public static readonly wireName = "PetExpeditionReq";
}

export class PetExpeditionResolveReq extends FromClientPacket {
	public static readonly wireName = "PetExpeditionResolveReq";
}
