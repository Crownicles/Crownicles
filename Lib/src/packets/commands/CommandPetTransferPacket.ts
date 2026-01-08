import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { OwnedPet } from "../../types/OwnedPet";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class CommandPetTransferPacketReq extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetTransferAnotherMemberTransferringErrorPacket extends CrowniclesPacket {
	keycloakId!: string;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetTransferCancelErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetTransferSituationChangedErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetTransferNoPetErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetTransferFeistyErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetTransferPetOnExpeditionErrorPacket extends CrowniclesPacket {}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetTransferSuccessPacket extends CrowniclesPacket {
	oldPet?: OwnedPet;

	newPet?: OwnedPet;
}
