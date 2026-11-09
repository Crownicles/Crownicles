import { FromClientPacket } from "./FromClientPacket";

export class PetTransferReq extends FromClientPacket {
	public static readonly wireName = "PetTransferReq";
}
export class PetFreeReq extends FromClientPacket {
	public static readonly wireName = "PetFreeReq";
}
export class PetSellReq extends FromClientPacket {
	public static readonly wireName = "PetSellReq";

	rank!: number;

	price!: number;
}
export class GuildShelterReq extends FromClientPacket {
	public static readonly wireName = "GuildShelterReq";
}
