import { FromServerPacket } from "../FromServerPacket";

export class RarityRes extends FromServerPacket {
	public static readonly wireName = "RarityRes";

	public rarities!: number[];
}
