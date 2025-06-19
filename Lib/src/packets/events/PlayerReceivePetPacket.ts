import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { SexTypeShort } from "../../constants/StringConstants";

@sendablePacket(PacketDirection.BACK_TO_FRONT)
export class PlayerReceivePetPacket extends CrowniclesPacket {
	noRoomInGuild!: boolean;

	giveInGuild!: boolean;

	giveInPlayerInv!: boolean;

	petTypeId!: number;

	petSex!: SexTypeShort;
}
