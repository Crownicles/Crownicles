import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { OwnedPet } from "../../types/OwnedPet";
import { SexTypeShort } from "../../constants/StringConstants";

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

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetTransferFreeCooldownErrorPacket extends CrowniclesPacket {
	cooldownRemainingTimeMs!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetTransferFreeMissingMoneyErrorPacket extends CrowniclesPacket {
	missingMoney!: number;
}

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class CommandPetTransferFreeSuccessPacket extends CrowniclesPacket {
	petId!: number;

	petSex!: SexTypeShort;

	petNickname?: string;

	freeCost!: number;

	luckyMeat!: boolean;
}
