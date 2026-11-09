import { FromServerPacket } from "../FromServerPacket";

export class TestCommandRes extends FromServerPacket {
	public static readonly wireName = "TestCommandRes";

	public commandName!: string;

	public result!: string;

	public isError!: boolean;
}

export type TestCommandInfo = {
	name: string;

	aliases?: string[];

	category?: string;

	description?: string;

	format?: string;
};

export class TestListRes extends FromServerPacket {
	public static readonly wireName = "TestListRes";

	/** Whether the server runs test commands at all. */
	public testMode!: boolean;

	public commands!: TestCommandInfo[];
}
