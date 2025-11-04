import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { OwnedPet } from "../../types/OwnedPet";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetPacketReq extends CrowniclesPacket {
	askedPlayer!: {
		rank?: number;
		keycloakId?: string;
	};
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetPacketRes extends CrowniclesPacket {
	askedKeycloakId?: string | null;

	pet!: OwnedPet;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetPetNotFound extends CrowniclesPacket {
}

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetCaressPacketReq extends CrowniclesPacket {
}
