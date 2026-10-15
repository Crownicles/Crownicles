import { fromServerTranslator } from "../FromServerTranslator";
import { PacketContext } from "../../../../../Lib/src/packets/CrowniclesPacket";
import { CommandTestPacketRes } from "../../../../../Lib/src/packets/commands/CommandTestPacket";
import { CommandTestListPacketRes } from "../../../../../Lib/src/packets/commands/CommandTestListPacket";
import {
	TestCommandRes, TestListRes
} from "../../../../../WsPackets/src/fromServer/test/TestRes";
import { asyncMakeFromServerPacket } from "../../../../../WsPackets/src/MakePackets";

export default class TestCommandServerTranslator {
	/** Exported files are left to Discord: the app only shows the text. */
	@fromServerTranslator(CommandTestPacketRes, TestCommandRes)
	public static translateCommand(_context: PacketContext, packet: CommandTestPacketRes): Promise<TestCommandRes> {
		return asyncMakeFromServerPacket(TestCommandRes, {
			commandName: packet.commandName,
			result: packet.result,
			isError: packet.isError
		});
	}

	@fromServerTranslator(CommandTestListPacketRes, TestListRes)
	public static translateList(_context: PacketContext, packet: CommandTestListPacketRes): Promise<TestListRes> {
		return asyncMakeFromServerPacket(TestListRes, {
			testMode: packet.testMode,
			commands: packet.commands
		});
	}
}
