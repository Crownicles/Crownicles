import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetNickPacketReq extends CrowniclesPacket {
	keycloakId!: string;

	newNickname?: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetNickPacketRes extends CrowniclesPacket {
	foundPet!: boolean;

	newNickname?: string;

	nickNameIsAcceptable?: boolean;
}
