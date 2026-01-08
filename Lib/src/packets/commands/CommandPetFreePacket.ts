import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SexTypeShort } from "../../constants/StringConstants";
import { OwnedPet } from "../../types/OwnedPet";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetFreePacketReq extends CrowniclesPacket {
	keycloakId!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetFreePacketRes extends CrowniclesPacket {
	foundPet!: boolean;

	petCanBeFreed?: boolean;

	missingMoney?: number;

	cooldownRemainingTimeMs?: number;

	petOnExpedition?: boolean;

	// Shelter pets available for freeing (only if player has a guild)
	shelterPets?: {
		petEntityId: number;
		pet: OwnedPet;
	}[];

	// Player's own pet info (for display purposes in selection menu)
	ownPet?: OwnedPet;

	// If true, player needs to choose between own pet and shelter pets
	needsSelection?: boolean;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetFreeRefusePacketRes extends CrowniclesPacket {

}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetFreeAcceptPacketRes extends CrowniclesPacket {
	petId!: number;

	petSex!: SexTypeShort;

	petNickname?: string;

	freeCost!: number;

	luckyMeat!: boolean;
}

// Packet for shelter pet free success
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetFreeShelterSuccessPacketRes extends CrowniclesPacket {
	petId!: number;

	petSex!: SexTypeShort;

	petNickname?: string;

	freeCost!: number;

	luckyMeat!: boolean;
}

// Packet for shelter pet free cooldown error
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetFreeShelterCooldownErrorPacketRes extends CrowniclesPacket {
	cooldownRemainingTimeMs!: number;
}

// Packet for shelter pet free missing money error
@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetFreeShelterMissingMoneyErrorPacketRes extends CrowniclesPacket {
	missingMoney!: number;
}
