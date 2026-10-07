import { FromClientPacket } from "./FromClientPacket";

/** Runs test commands, chained with " && " as on Discord; Core ignores it outside test mode. */
export class TestCommandReq extends FromClientPacket {
	public static readonly wireName = "TestCommandReq";

	public command!: string;
}

export class TestListReq extends FromClientPacket {
	public static readonly wireName = "TestListReq";
}
