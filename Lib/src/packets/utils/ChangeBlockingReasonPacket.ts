import {
	CrowniclesPacket, PacketDirection, sendablePacket
} from "../CrowniclesPacket";
import { BlockingReason } from "../../constants/BlockingConstants";

@sendablePacket(PacketDirection.FRONT_TO_BACK)
export class ChangeBlockingReasonPacket extends CrowniclesPacket {
	oldReason!: BlockingReason;

	newReason!: BlockingReason;
}
