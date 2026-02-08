import { SmallEventPacket } from "./SmallEventPacket";
import {
	PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SexTypeShort } from "../../constants/StringConstants";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class SmallEventPetDropTokenPacket extends SmallEventPacket {
	petTypeId!: number;

	petSex!: SexTypeShort;

	petNickname!: string | undefined;

	ownerKeycloakId!: string;
}
