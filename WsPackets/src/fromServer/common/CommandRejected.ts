import { FromServerPacket } from "../FromServerPacket";
import { CommandRejection } from "../../objects/CommandRejection";

export class CommandRejected extends FromServerPacket {
	public static readonly wireName = "CommandRejected";

	public rejection!: CommandRejection;
}
