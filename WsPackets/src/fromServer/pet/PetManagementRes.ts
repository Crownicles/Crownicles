import { FromServerPacket } from "../FromServerPacket";
import { PetManagementOutcome } from "../../objects/PetManagement";
import { OwnedPet } from "../../objects/OwnedPet";

export class PetManagementRes extends FromServerPacket {
	public static readonly wireName = "PetManagementRes";

	public outcome!: PetManagementOutcome;
}
export class GuildShelterRes extends FromServerPacket {
	public static readonly wireName = "GuildShelterRes";

	public guildName!: string;

	public pets!: OwnedPet[];

	public maxCount!: number;
}
export class GuildShelterEmptyRes extends FromServerPacket {
	public static readonly wireName = "GuildShelterEmptyRes";
}
