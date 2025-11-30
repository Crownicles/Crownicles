import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SexTypeShort } from "../../constants/StringConstants";

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
