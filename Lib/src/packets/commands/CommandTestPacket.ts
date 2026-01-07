import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandTestPacketReq extends CrowniclesPacket {
	keycloakId!: string;

	command?: string;

	args?: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandTestPacketRes extends CrowniclesPacket {
	commandName!: string;

	result!: string;

	isError!: boolean;

	fileName?: string;

	fileContentBase64?: string;
}
